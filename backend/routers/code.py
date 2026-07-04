import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models, schemas
from routers.auth import get_current_user
from services.code_execution import CodeExecutionService

router = APIRouter(prefix="/code", tags=["Code Sandbox"])
execution_service = CodeExecutionService()

@router.post("/run", response_model=schemas.CodeRunResponse)
async def run_code(
    payload: schemas.CodeRunRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == payload.attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")
    
    if attempt.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to execute code for this attempt.")

    try:
        response = await execution_service.run_visible_tests(
            db=db,
            attempt_id=payload.attempt_id,
            question_id=payload.question_id,
            language=payload.language,
            source_code=payload.source_code
        )
        return response
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code execution error: {str(e)}")


@router.post("/save")
def save_draft(
    payload: schemas.CodeSaveRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    attempt = db.query(models.Attempt).filter(
        models.Attempt.id == payload.attempt_id,
        models.Attempt.status == "active"
    ).first()
    if not attempt:
        raise HTTPException(status_code=400, detail="Active exam attempt not found.")

    if attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to modify this attempt.")

    draft = db.query(models.AttemptCodeDraft).filter(
        models.AttemptCodeDraft.attempt_id == payload.attempt_id,
        models.AttemptCodeDraft.question_id == payload.question_id,
        models.AttemptCodeDraft.language == payload.language
    ).first()

    if draft:
        draft.source_code = payload.source_code
        draft.updated_at = datetime.datetime.utcnow()
    else:
        draft = models.AttemptCodeDraft(
            attempt_id=payload.attempt_id,
            question_id=payload.question_id,
            language=payload.language,
            source_code=payload.source_code,
            updated_at=datetime.datetime.utcnow()
        )
        db.add(draft)

    db.commit()
    return {"status": "success", "detail": "Draft saved successfully."}


@router.get("/draft/{attempt_id}/{question_id}/{language}", response_model=schemas.CodeDraftResponse)
def get_draft(
    attempt_id: int,
    question_id: int,
    language: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    if attempt.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to access this attempt draft.")

    draft = db.query(models.AttemptCodeDraft).filter(
        models.AttemptCodeDraft.attempt_id == attempt_id,
        models.AttemptCodeDraft.question_id == question_id,
        models.AttemptCodeDraft.language == language
    ).first()

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found for this language.")

    return draft


@router.post("/telemetry/event")
async def update_telemetry(
    payload: schemas.CodingTelemetryUpdateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    attempt = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).filter(
        models.Attempt.id == payload.attempt_id,
        models.Attempt.status == "active"
    ).first()
    if not attempt:
        raise HTTPException(status_code=400, detail="Active exam attempt not found.")

    if attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized.")

    user_name = attempt.user.name
    assessment_name = attempt.snapshot.assessment.name

    event_type = payload.event_type.strip().lower()
    paste_length = payload.paste_length or 0
    is_large_paste = (event_type == "paste" and paste_length >= 50) or (event_type == "large_paste")

    db.close()

    from services.event_buffer import event_buffer
    await event_buffer.add_telemetry(payload.attempt_id, payload.question_id, event_type, paste_length)

    if is_large_paste:
        details = f"Large code paste detected on Question ID {payload.question_id} ({paste_length} chars)."
        
        from services.tasks import task_service
        task_service.queue_violation_log(
            background_tasks,
            payload.attempt_id,
            "large_paste",
            "medium",
            details
        )
        
        from routers.proctoring import manager
        event_payload = {
            "type": "violation_triggered",
            "violation": {
                "id": 0,
                "attempt_id": payload.attempt_id,
                "type": "large_paste",
                "severity": "medium",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "details": details,
                "candidate_name": user_name,
                "assessment_name": assessment_name,
                "screenshot_url": ""
            }
        }
        await manager.broadcast_to_admins(event_payload)

    return {"status": "success", "detail": "Telemetry event logged."}
