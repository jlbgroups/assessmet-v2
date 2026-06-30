import os
import datetime
from typing import List, Dict, Set, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from database import get_db
import models, schemas, auth, supabase_client
from routers.auth import get_current_admin, get_current_user

router = APIRouter(prefix="/proctoring", tags=["Proctoring"])

class ConnectionManager:
    def __init__(self):
        self.admins: Set[WebSocket] = set()
        self.candidates: Dict[int, WebSocket] = {}
        self.active_attempts: Dict[int, Dict[str, Any]] = {}

    async def connect_admin(self, websocket: WebSocket):
        self.admins.add(websocket)

    def disconnect_admin(self, websocket: WebSocket):
        self.admins.discard(websocket)

    async def connect_candidate(self, websocket: WebSocket, attempt_id: int, attempt_info: dict):
        self.candidates[attempt_id] = websocket
        self.active_attempts[attempt_id] = {
            **attempt_info,
            "last_active": datetime.datetime.utcnow().isoformat(),
            "status": "active"
        }
        await self.broadcast_to_admins({
            "type": "candidate_connected",
            "attempt_id": attempt_id,
            "info": self.active_attempts[attempt_id]
        })

    async def disconnect_candidate(self, attempt_id: int):
        if attempt_id in self.candidates:
            del self.candidates[attempt_id]
        if attempt_id in self.active_attempts:
            self.active_attempts[attempt_id]["status"] = "disconnected"
            await self.broadcast_to_admins({
                "type": "candidate_disconnected",
                "attempt_id": attempt_id
            })

    async def send_to_candidate(self, attempt_id: int, message: dict):
        if attempt_id in self.candidates:
            try:
                await self.candidates[attempt_id].send_json(message)
            except Exception:
                await self.disconnect_candidate(attempt_id)

    async def broadcast_to_admins(self, message: dict):
        dead_admins = set()
        for admin in self.admins:
            try:
                await admin.send_json(message)
            except Exception:
                dead_admins.add(admin)
        for admin in dead_admins:
            self.admins.discard(admin)

manager = ConnectionManager()



@router.post("/system-check-passed")
def system_check_passed(request_data: Dict[str, Any], db: Session = Depends(get_db)):
    attempt_id = request_data.get("attempt_id")
    token = request_data.get("exam_session_token")
    
    if not attempt_id or not token:
        raise HTTPException(status_code=400, detail="Missing attempt_id or exam_session_token")
        
    token_db = db.query(models.ExamSessionToken).filter(
        models.ExamSessionToken.attempt_id == attempt_id,
        models.ExamSessionToken.token == token,
        models.ExamSessionToken.expires_at > datetime.datetime.utcnow()
    ).first()
    
    if not token_db:
        raise HTTPException(status_code=401, detail="Invalid or expired exam session token")
        
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    attempt.system_check_passed = True
    db.commit()
    db.close()
    return {"detail": "System check status updated to passed"}


@router.post("/event")
async def log_violation_event(
    violation_data: schemas.ViolationCreate,
    exam_session_token: str,
    attempt_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    token_db = db.query(models.ExamSessionToken).filter(
        models.ExamSessionToken.attempt_id == attempt_id,
        models.ExamSessionToken.token == exam_session_token,
        models.ExamSessionToken.expires_at > datetime.datetime.utcnow()
    ).first()
    
    if not token_db:
        raise HTTPException(status_code=401, detail="Invalid or expired exam session token")
        
    attempt = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    user_name = attempt.user.name
    assessment_name = attempt.snapshot.assessment.name
    
    db.close()
    
    from services.tasks import task_service
    task_service.queue_violation_log(
        background_tasks,
        attempt_id,
        violation_data.type,
        violation_data.severity,
        violation_data.details
    )
    
    event_payload = {
        "type": "violation_triggered",
        "violation": {
            "id": 0,
            "attempt_id": attempt_id,
            "type": violation_data.type,
            "severity": violation_data.severity,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "details": violation_data.details,
            "candidate_name": user_name,
            "assessment_name": assessment_name,
            "screenshot_url": ""
        }
    }
    await manager.broadcast_to_admins(event_payload)
    
    return {"detail": "Violation event recorded", "id": 0}


@router.post("/screenshot")
async def upload_violation_screenshot(
    background_tasks: BackgroundTasks,
    attempt_id: int = Form(...),
    exam_session_token: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    token_db = db.query(models.ExamSessionToken).filter(
        models.ExamSessionToken.attempt_id == attempt_id,
        models.ExamSessionToken.token == exam_session_token,
        models.ExamSessionToken.expires_at > datetime.datetime.utcnow()
    ).first()
    
    if not token_db:
        raise HTTPException(status_code=401, detail="Invalid or expired exam session token")
        
    attempt = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    user_name = attempt.user.name
    assessment_name = attempt.snapshot.assessment.name
    
    db.close()
    
    content = await file.read()
    
    screenshot_path = supabase_client.upload_screenshot(attempt_id, content)
    
    filename_lower = file.filename.lower()
    if "screenshare" in filename_lower:
        if "tab_switch" in filename_lower:
            violation_type = "tab_switch"
            severity = "medium"
            details = "Candidate switched tabs or unfocused browser"
        elif "fullscreen" in filename_lower:
            violation_type = "fullscreen_exit"
            severity = "medium"
            details = "Candidate exited fullscreen mode"
        else:
            violation_type = "screen_periodic"
            severity = "info"
            details = "Periodic screen sharing capture"
    else:
        if "mobile" in filename_lower:
            violation_type = "mobile_phone"
            severity = "high"
            details = "Automated camera snapshot detection: mobile phone"
        elif "noface" in filename_lower:
            violation_type = "no_face"
            severity = "medium"
            details = "Automated camera snapshot detection: no face"
        elif "multiple" in filename_lower:
            violation_type = "multiple_faces"
            severity = "medium"
            details = "Automated camera snapshot detection: multiple faces"
        elif "tab_switch" in filename_lower:
            violation_type = "tab_switch"
            severity = "medium"
            details = "Candidate switched tabs or unfocused browser"
        elif "fullscreen" in filename_lower:
            violation_type = "fullscreen_exit"
            severity = "medium"
            details = "Candidate exited fullscreen mode"
        else:
            violation_type = "periodic"
            severity = "info"
            details = "Periodic live feed snapshot"
        
    signed_url = supabase_client.get_screenshot_signed_url(screenshot_path)
    
    from services.tasks import task_service
    task_service.queue_screenshot_violation_log(
        background_tasks,
        attempt_id,
        violation_type,
        severity,
        details,
        screenshot_path
    )
    
    event_payload = {
        "type": "violation_triggered",
        "violation": {
            "id": 0,
            "attempt_id": attempt_id,
            "type": violation_type,
            "severity": severity,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "details": details,
            "candidate_name": user_name,
            "assessment_name": assessment_name,
            "screenshot_url": signed_url
        }
    }
    await manager.broadcast_to_admins(event_payload)
    
    return {"detail": "Screenshot uploaded and violation recorded", "screenshot_url": signed_url}


@router.get("/violations", response_model=List[schemas.ViolationResponse])
def get_violations(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    violations = db.query(models.Violation).options(
        joinedload(models.Violation.attempt).joinedload(models.Attempt.user).joinedload(models.User.institute),
        joinedload(models.Violation.attempt).joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).filter(
        models.Violation.type != "periodic",
        models.Violation.type != "screen_periodic"
    ).order_by(models.Violation.timestamp.desc()).limit(limit).all()
    
    violations.reverse()
    
    results = []
    for v in violations:
        attempt = v.attempt
        user = attempt.user if attempt else None
        snapshot = attempt.snapshot if attempt else None
        assess = snapshot.assessment if snapshot else None
        
        results.append(
            schemas.ViolationResponse(
                id=v.id,
                attempt_id=v.attempt_id,
                type=v.type,
                severity=v.severity,
                timestamp=v.timestamp,
                screenshot_url=v.screenshot_path,
                details=v.details,
                candidate_name=user.name if user else "Unknown",
                candidate_id=user.id if user else None,
                institute_name=user.institute.name if (user and user.institute) else "Direct to Candidates",
                assessment_name=assess.name if assess else "Unknown"
            )
        )
    return results


@router.get("/violations/candidate/{candidate_id}")
def get_candidate_violations(
    candidate_id: int,
    page: int = 1,
    limit: int = 25,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    total_query = db.query(models.Violation).join(models.Attempt).filter(
        models.Attempt.user_id == candidate_id,
        models.Violation.type != "periodic",
        models.Violation.type != "screen_periodic"
    )
    total = total_query.count()
    
    violations = total_query.options(
        joinedload(models.Violation.attempt).joinedload(models.Attempt.user).joinedload(models.User.institute),
        joinedload(models.Violation.attempt).joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).order_by(models.Violation.timestamp.desc()).offset((page - 1) * limit).limit(limit).all()
    
    results = []
    for v in violations:
        attempt = v.attempt
        user = attempt.user if attempt else None
        assess = attempt.snapshot.assessment if attempt else None
        
        results.append(
            schemas.ViolationResponse(
                id=v.id,
                attempt_id=v.attempt_id,
                type=v.type,
                severity=v.severity,
                timestamp=v.timestamp,
                screenshot_url=v.screenshot_path,
                details=v.details,
                candidate_name=user.name if user else "Unknown",
                candidate_id=user.id if user else None,
                institute_name=user.institute.name if (user and user.institute) else "Direct to Candidates",
                assessment_name=assess.name if assess else "Unknown"
            )
        )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "results": results
    }


@router.get("/violations/{id}/image")
def get_violation_image(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    violation = db.query(models.Violation).filter(models.Violation.id == id).first()
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
        
    attempt = db.query(models.Attempt).filter(models.Attempt.id == violation.attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    if current_user.role != "admin" and attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this screenshot")
        
    if not violation.screenshot_path:
        raise HTTPException(status_code=404, detail="No screenshot available for this violation")
        
    db.close()
    
    signed_url = supabase_client.get_screenshot_signed_url(violation.screenshot_path)
    return {"url": signed_url}


@router.get("/active-candidates", response_model=List[schemas.ActiveCandidateStatus])
def get_active_candidates(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    active_attempts = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).filter(models.Attempt.status == "active").all()
    
    active_attempt_ids = [a.id for a in active_attempts]
    
    violation_counts = {}
    last_violations = {}
    signed_urls_map = {}
    critical_attempts = set()
    
    if active_attempt_ids:
        violation_counts = dict(
            db.query(
                models.Violation.attempt_id, func.count(models.Violation.id)
            ).filter(
                models.Violation.attempt_id.in_(active_attempt_ids),
                models.Violation.type != "periodic",
                models.Violation.type != "screen_periodic"
            ).group_by(models.Violation.attempt_id).all()
        )
        
        subq = db.query(
            models.Violation.attempt_id,
            func.max(models.Violation.timestamp).label("max_ts")
        ).filter(
            models.Violation.attempt_id.in_(active_attempt_ids),
            models.Violation.screenshot_path != None
        ).group_by(models.Violation.attempt_id).subquery()
        
        last_violations_list = db.query(models.Violation).join(
            subq,
            and_(
                models.Violation.attempt_id == subq.c.attempt_id,
                models.Violation.timestamp == subq.c.max_ts
            )
        ).all()
        
        last_violations = {v.attempt_id: v for v in last_violations_list}
        
        critical_attempts = set(
            r[0] for r in db.query(models.Violation.attempt_id).filter(
                models.Violation.attempt_id.in_(active_attempt_ids),
                models.Violation.severity == "critical"
            ).all()
        )
        
    db.close()
    
    if active_attempt_ids:
        screenshot_paths = [v.screenshot_path for v in last_violations_list if v.screenshot_path]
        signed_urls_map = supabase_client.get_screenshots_signed_urls(screenshot_paths)
        
    results = []
    for attempt in active_attempts:
        user = attempt.user
        assessment = attempt.snapshot.assessment
        violation_count = violation_counts.get(attempt.id, 0)
        
        last_violation = last_violations.get(attempt.id)
        screenshot_url = ""
        if last_violation and last_violation.screenshot_path:
            screenshot_url = signed_urls_map.get(last_violation.screenshot_path, "")
            
        status_color = "active"
        if violation_count > 0:
            status_color = "warning"
        if violation_count >= 5 or attempt.id in critical_attempts:
            status_color = "critical"
            
        results.append(
            schemas.ActiveCandidateStatus(
                attempt_id=attempt.id,
                candidate_name=user.name,
                email=user.email,
                assessment_name=assessment.name,
                status=status_color,
                violation_count=violation_count,
                system_check_passed=attempt.system_check_passed,
                last_active=attempt.started_at,  
                screenshot_url=screenshot_url
            )
        )
    return results


@router.post("/control/{attempt_id}")
async def control_candidate(attempt_id: int, control_action: Dict[str, Any], db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    action = control_action.get("action")
    message = control_action.get("message", "")
    
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")
        
    if action == "terminate":
        attempt.status = "terminated"
        attempt.completed_at = datetime.datetime.utcnow()
        db.commit()
    elif action == "force_submit":
        attempt.status = "completed"
        attempt.completed_at = datetime.datetime.utcnow()
        db.commit()
        
    await manager.send_to_candidate(attempt_id, {
        "type": "admin_control",
        "action": action,
        "message": message
    })
    
    await manager.broadcast_to_admins({
        "type": "candidate_status_changed",
        "attempt_id": attempt_id,
        "status": attempt.status,
        "action": action
    })
    
    return {"detail": f"Action {action} sent successfully"}





@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    
    current_attempt_id = None
    role = None
    
    try:
        auth_msg = await websocket.receive_json()
        msg_type = auth_msg.get("type")
        
        if msg_type == "auth_admin":
            token = auth_msg.get("token")
            payload = auth.verify_token(token, "access")
            if not payload or payload.get("role") != "admin":
                await websocket.send_json({"type": "auth_failed", "detail": "Invalid admin token"})
                await websocket.close()
                return
            role = "admin"
            websocket_index = len(manager.admins)
            await manager.connect_admin(websocket)
            await websocket.send_json({"type": "auth_success", "role": "admin"})
            
            
        elif msg_type == "auth_candidate":
            token = auth_msg.get("token")
            attempt_id = auth_msg.get("attempt_id")
            
            token_db = db.query(models.ExamSessionToken).filter(
                models.ExamSessionToken.attempt_id == attempt_id,
                models.ExamSessionToken.token == token,
                models.ExamSessionToken.expires_at > datetime.datetime.utcnow()
            ).first()
            
            if not token_db:
                await websocket.send_json({"type": "auth_failed", "detail": "Invalid exam session token"})
                await websocket.close()
                return
                
            attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
            if not attempt or attempt.status != "active":
                await websocket.send_json({"type": "auth_failed", "detail": "Attempt not active"})
                await websocket.close()
                return
                
            role = "candidate"
            current_attempt_id = attempt_id
            
            attempt_info = {
                "name": attempt.user.name,
                "email": attempt.user.email,
                "assessment": attempt.snapshot.assessment.name,
                "started_at": attempt.started_at.isoformat()
            }
            await manager.connect_candidate(websocket, attempt_id, attempt_info)
            await websocket.send_json({"type": "auth_success", "role": "candidate"})
        else:
            await websocket.send_json({"type": "auth_failed", "detail": "Unsupported authentication type"})
            await websocket.close()
            return
            
        while True:
            data = await websocket.receive_json()
            
            if role == "candidate":
                data_type = data.get("type")
                if data_type == "heartbeat":
                    if current_attempt_id in manager.active_attempts:
                        manager.active_attempts[current_attempt_id]["last_active"] = datetime.datetime.utcnow().isoformat()
                        await manager.broadcast_to_admins({
                            "type": "candidate_heartbeat",
                            "attempt_id": current_attempt_id
                        })
                        
    except WebSocketDisconnect:
        if role == "admin":
            manager.disconnect_admin(websocket)
        elif role == "candidate" and current_attempt_id:
            await manager.disconnect_candidate(current_attempt_id)
    except Exception as e:
        print(f"Error in websocket loop: {e}")
        if role == "admin":
            manager.disconnect_admin(websocket)
        elif role == "candidate" and current_attempt_id:
            await manager.disconnect_candidate(current_attempt_id)
