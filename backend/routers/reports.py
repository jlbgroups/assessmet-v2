import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast, Date
from database import get_db
import models, schemas
from routers.auth import get_current_admin, get_current_user
from supabase_client import get_screenshots_signed_urls
from typing import List


router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/candidate/{attempt_id}")
def get_candidate_report(attempt_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    attempt = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).filter(models.Attempt.id == attempt_id).first()
    
    if not attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")
        
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to view this report")
        
    user = attempt.user
    snapshot = attempt.snapshot
    assessment = snapshot.assessment
    
    questions_snapshot = snapshot.snapshot_data.get("questions", [])
    snapshot_total_marks = sum(int(q.get("marks", 1)) for q in questions_snapshot)
    if snapshot_total_marks == 0:
        snapshot_total_marks = assessment.total_marks
    
    violations = db.query(models.Violation).filter(
        models.Violation.attempt_id == attempt_id,
        models.Violation.type != "periodic"
    ).all()
    
    passed = False
    percent = 0
    if attempt.score is not None:
        percent = (attempt.score / snapshot_total_marks) * 100 if snapshot_total_marks > 0 else 0
        passed = attempt.score >= assessment.passing_marks
        
    rank = 1
    if attempt.score is not None:
        higher_scores_count = db.query(models.Attempt).filter(
            models.Attempt.assessment_snapshot_id == attempt.assessment_snapshot_id,
            models.Attempt.status == "completed",
            models.Attempt.score > attempt.score
        ).count()
        rank = higher_scores_count + 1
        
    db.close()
    
    screenshot_paths = [v.screenshot_path for v in violations if v.screenshot_path]
    signed_urls_map = get_screenshots_signed_urls(screenshot_paths)
    
    violation_list = []
    for v in violations:
        screenshot_url = signed_urls_map.get(v.screenshot_path, "") if v.screenshot_path else ""
        violation_list.append({
            "id": v.id,
            "type": v.type,
            "severity": v.severity,
            "timestamp": v.timestamp.isoformat(),
            "details": v.details,
            "screenshot_url": screenshot_url
        })
        
    return {
        "candidate": {
            "name": user.name,
            "email": user.email,
            "id": user.id
        },
        "assessment": {
            "name": assessment.name,
            "total_marks": snapshot_total_marks,
            "passing_marks": assessment.passing_marks,
            "duration_minutes": assessment.duration_minutes
        },
        "attempt": {
            "id": attempt.id,
            "started_at": attempt.started_at.isoformat(),
            "completed_at": attempt.completed_at.isoformat() if attempt.completed_at else None,
            "score": attempt.score,
            "percentage": percent,
            "rank": rank,
            "status": attempt.status,
            "passed": passed
        },
        "violations": violation_list,
        "questions_count": len(questions_snapshot),
        "questions": [
            {
                "id": q.get("id"),
                "title": q.get("title"),
                "type": q.get("type"),
                "marks": q.get("marks", 1),
                "difficulty": q.get("difficulty")
            }
            for q in questions_snapshot
        ]
    }

@router.get("/admin/code-submissions/{attempt_id}", response_model=List[schemas.CodeSubmissionResponse])
def get_admin_code_submissions(attempt_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    submissions = db.query(models.CodeSubmission).filter(
        models.CodeSubmission.attempt_id == attempt_id,
        models.CodeSubmission.is_draft == False
    ).order_by(models.CodeSubmission.created_at.asc()).all()
    return submissions

@router.get("/assessment/{assessment_id}")
def get_assessment_report(assessment_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    attempts = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot)
    ).join(
        models.AssessmentSnapshot, models.AssessmentSnapshot.id == models.Attempt.assessment_snapshot_id
    ).filter(models.AssessmentSnapshot.assessment_id == assessment_id).all()
    
    total_candidates = len(attempts)
    completed_attempts = [a for a in attempts if a.status == "completed"]
    completed_count = len(completed_attempts)
    
    passed_count = 0
    failed_count = 0
    total_score = 0
    
    for a in completed_attempts:
        if a.score is not None:
            total_score += a.score
            if a.score >= assessment.passing_marks:
                passed_count += 1
            else:
                failed_count += 1
                
    avg_score = (total_score / completed_count) if completed_count > 0 else 0
    pass_rate = (passed_count / completed_count * 100) if completed_count > 0 else 0
    
    violation_counts = db.query(
        models.Violation.type, func.count(models.Violation.id)
    ).join(models.Attempt).join(models.AssessmentSnapshot).filter(
        models.AssessmentSnapshot.assessment_id == assessment_id,
        models.Violation.type != "periodic"
    ).group_by(models.Violation.type).all()
    
    violation_summary = {t: c for t, c in violation_counts}
    
    attempt_violation_counts = db.query(
        models.Violation.attempt_id, func.count(models.Violation.id)
    ).join(models.Attempt).join(models.AssessmentSnapshot).filter(
        models.AssessmentSnapshot.assessment_id == assessment_id,
        models.Violation.type != "periodic"
    ).group_by(models.Violation.attempt_id).all()
    attempt_violation_map = {att_id: count for att_id, count in attempt_violation_counts}
    
    attempts_list = []
    for a in attempts:
        violation_count = attempt_violation_map.get(a.id, 0)
        
        snapshot_questions = a.snapshot.snapshot_data.get("questions", [])
        snapshot_total_marks = sum(int(q.get("marks", 1)) for q in snapshot_questions)
        if snapshot_total_marks == 0:
            snapshot_total_marks = assessment.total_marks
            
        percent = (a.score / snapshot_total_marks * 100) if a.score is not None and snapshot_total_marks > 0 else 0
        
        attempts_list.append({
            "attempt_id": a.id,
            "candidate_name": a.user.name,
            "email": a.user.email,
            "score": a.score,
            "percentage": percent,
            "status": a.status,
            "started_at": a.started_at.isoformat(),
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "passed": a.score >= assessment.passing_marks if a.score is not None else False,
            "violation_count": violation_count
        })
    
    return {
        "assessment_name": assessment.name,
        "total_marks": assessment.total_marks,
        "passing_marks": assessment.passing_marks,
        "total_candidates": total_candidates,
        "completed_count": completed_count,
        "passed_count": passed_count,
        "failed_count": failed_count,
        "average_score": avg_score,
        "pass_rate_percentage": pass_rate,
        "violations_summary": violation_summary,
        "attempts": attempts_list
    }

@router.get("/institute/{institute_id}")
def get_institute_report(institute_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    institute = db.query(models.Institute).filter(models.Institute.id == institute_id).first()
    if not institute:
        raise HTTPException(status_code=404, detail="Institute not found")
        
    candidates = db.query(models.User).filter(
        models.User.institute_id == institute_id,
        models.User.role == "candidate"
    ).all()
    
    total_candidates = len(candidates)
    
    attempts = db.query(models.Attempt).options(
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).join(models.User).filter(
        models.User.institute_id == institute_id
    ).all()
    
    total_attempts = len(attempts)
    completed_attempts = [a for a in attempts if a.status == "completed"]
    completed_count = len(completed_attempts)
    
    passed_count = 0
    for a in completed_attempts:
        assessment = a.snapshot.assessment if a.snapshot else None
        if assessment and a.score is not None and a.score >= assessment.passing_marks:
            passed_count += 1
            
    pass_rate = (passed_count / completed_count * 100) if completed_count > 0 else 0
    
    from collections import defaultdict
    attempts_by_user = defaultdict(list)
    for a in attempts:
        attempts_by_user[a.user_id].append(a)
        
    attempt_violation_counts = db.query(
        models.Violation.attempt_id, func.count(models.Violation.id)
    ).join(models.Attempt).join(models.User).filter(
        models.User.institute_id == institute_id,
        models.Violation.type != "periodic"
    ).group_by(models.Violation.attempt_id).all()
    attempt_violation_map = {att_id: count for att_id, count in attempt_violation_counts}
    
    candidate_list = []
    for user in candidates:
        user_attempts = attempts_by_user[user.id]
        
        attempts_data = []
        completed_scores_pct = []
        total_user_violations = 0
        
        for a in user_attempts:
            assessment = a.snapshot.assessment if a.snapshot else None
            assessment_name = assessment.name if assessment else "Unknown Assessment"
            passing_marks = assessment.passing_marks if assessment else 0
            
            snapshot_questions = a.snapshot.snapshot_data.get("questions", []) if a.snapshot and a.snapshot.snapshot_data else []
            snapshot_total_marks = sum(int(q.get("marks", 1)) for q in snapshot_questions)
            if snapshot_total_marks == 0:
                snapshot_total_marks = assessment.total_marks if assessment else 100
            
            percent = (a.score / snapshot_total_marks * 100) if a.score is not None and snapshot_total_marks > 0 else 0
            passed = a.score >= passing_marks if a.score is not None else False
            
            violation_count = attempt_violation_map.get(a.id, 0)
            total_user_violations += violation_count
            
            if a.status == "completed" and a.score is not None:
                completed_scores_pct.append(percent)
                
            attempts_data.append({
                "attempt_id": a.id,
                "assessment_name": assessment_name,
                "score": a.score,
                "percentage": percent,
                "status": a.status,
                "passed": passed,
                "violation_count": violation_count
            })
            
        avg_pct = sum(completed_scores_pct) / len(completed_scores_pct) if completed_scores_pct else 0
        
        candidate_list.append({
            "candidate_id": user.id,
            "name": user.name,
            "email": user.email,
            "total_attempts": len(user_attempts),
            "completed_attempts": len(completed_scores_pct),
            "avg_percentage": avg_pct,
            "total_violations": total_user_violations,
            "attempts": attempts_data
        })
        
    return {
        "institute_name": institute.name,
        "total_registered_candidates": total_candidates,
        "total_exam_attempts": total_attempts,
        "completed_exams": completed_count,
        "pass_rate_percentage": pass_rate,
        "candidates": candidate_list
    }

@router.get("/admin/summary")
def get_admin_dashboard_summary(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    total_institutes = db.query(models.Institute).filter(models.Institute.deleted_at == None).count()
    total_assessments = db.query(models.Assessment).count()
    active_candidates = db.query(models.Attempt).filter(models.Attempt.status == "active").count()
    completed_tests = db.query(models.Attempt).filter(models.Attempt.status == "completed").count()
    
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    violations_today = db.query(models.Violation).filter(models.Violation.timestamp >= today_start).count()
    
    seven_days_ago = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - datetime.timedelta(days=6)
    violation_counts = db.query(
        cast(models.Violation.timestamp, Date).label('day'),
        func.count(models.Violation.id).label('count')
    ).filter(
        models.Violation.timestamp >= seven_days_ago
    ).group_by(
        cast(models.Violation.timestamp, Date)
    ).all()
    violation_map = {r.day: r.count for r in violation_counts}
    
    violation_trends = []
    for i in range(6, -1, -1):
        day = (datetime.datetime.utcnow() - datetime.timedelta(days=i)).date()
        day_str = day.strftime("%Y-%m-%d")
        violation_trends.append({"date": day_str, "count": violation_map.get(day, 0)})
        
    activity_counts = db.query(
        cast(models.Attempt.started_at, Date).label('day'),
        func.count(models.Attempt.id).label('attempts')
    ).filter(
        models.Attempt.started_at >= seven_days_ago
    ).group_by(
        cast(models.Attempt.started_at, Date)
    ).all()
    activity_map = {r.day: r.attempts for r in activity_counts}
    
    activity_trends = []
    for i in range(6, -1, -1):
        day = (datetime.datetime.utcnow() - datetime.timedelta(days=i)).date()
        day_str = (datetime.datetime.utcnow() - datetime.timedelta(days=i)).strftime("%b %d")
        activity_trends.append({"day": day_str, "attempts": activity_map.get(day, 0)})
        
    assignments = db.query(models.Assignment).options(
        joinedload(models.Assignment.assessment),
        joinedload(models.Assignment.institute)
    ).all()
    
    assignments_list = []
    for ass in assignments:
        assignments_list.append({
            "id": ass.id,
            "assessment_id": ass.assessment_id,
            "assessment_name": ass.assessment.name if ass.assessment else "Unknown Assessment",
            "institute_id": ass.institute_id,
            "institute_name": ass.institute.name if ass.institute else "Direct to Candidates",
            "role": ass.role,
            "job_title": ass.job_title
        })
        
    return {
        "metrics": {
            "total_institutes": total_institutes,
            "total_assessments": total_assessments,
            "active_candidates": active_candidates,
            "completed_tests": completed_tests,
            "violations_today": violations_today
        },
        "violation_trends": violation_trends,
        "activity_trends": activity_trends,
        "assignments": assignments_list
    }


def escape_csv_field(val: any) -> str:
    if val is None:
        return ""
    val_str = str(val)
    if val_str and val_str[0] in ('=', '+', '-', '@'):
        return "'" + val_str
    return val_str


@router.get("/assessment/{assessment_id}/csv")
def get_assessment_report_csv(
    assessment_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    attempts = db.query(models.Attempt).options(
        joinedload(models.Attempt.user).joinedload(models.User.institute),
        joinedload(models.Attempt.snapshot)
    ).join(
        models.AssessmentSnapshot, models.AssessmentSnapshot.id == models.Attempt.assessment_snapshot_id
    ).filter(models.AssessmentSnapshot.assessment_id == assessment_id).all()
    
    violation_counts = db.query(
        models.Violation.attempt_id, func.count(models.Violation.id)
    ).join(models.Attempt).join(models.AssessmentSnapshot).filter(
        models.AssessmentSnapshot.assessment_id == assessment_id,
        models.Violation.type != "periodic",
        models.Violation.type != "screen_periodic"
    ).group_by(models.Violation.attempt_id).all()
    violation_count_map = {att_id: count for att_id, count in violation_counts}
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Candidate Name", "Email", "Institute", "Assessment", "Score",
        "Started At", "Submitted At", "Violations", "Duration", "Status"
    ])
    
    for a in attempts:
        user = a.user
        institute_name = user.institute.name if user and user.institute else "Direct to Candidates"
        assess_name = a.snapshot.snapshot_data.get("name", assessment.name) if a.snapshot else assessment.name
        
        violation_count = violation_count_map.get(a.id, 0)
        
        duration_str = ""
        if a.completed_at:
            duration_str = f"{round((a.completed_at - a.started_at).total_seconds() / 60, 1)} min"
            
        score_str = str(a.score) if a.score is not None else ""
        started_at_str = a.started_at.strftime("%Y-%m-%d %H:%M:%S") if a.started_at else ""
        completed_at_str = a.completed_at.strftime("%Y-%m-%d %H:%M:%S") if a.completed_at else ""
        
        writer.writerow([
            escape_csv_field(user.name if user else "Unknown"),
            escape_csv_field(user.email if user else ""),
            escape_csv_field(institute_name),
            escape_csv_field(assess_name),
            escape_csv_field(score_str),
            escape_csv_field(started_at_str),
            escape_csv_field(completed_at_str),
            escape_csv_field(str(violation_count)),
            escape_csv_field(duration_str),
            escape_csv_field(a.status)
        ])
        
    output.seek(0)
    filename = f"bulk_report_{assessment.name.lower().replace(' ', '_')}_{assessment_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/attempt/{attempt_id}/csv")
def get_attempt_report_csv(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    attempt = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot)
    ).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    if current_user.role != "admin" and attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to access this report")
        
    snapshot = attempt.snapshot
    if not snapshot or not snapshot.snapshot_data:
        raise HTTPException(status_code=404, detail="Assessment snapshot not found")
        
    questions = snapshot.snapshot_data.get("questions", [])
    answers = attempt.answers_data or {}
    
    violations = db.query(models.Violation).filter(models.Violation.attempt_id == attempt_id).all()
    violation_count = sum(1 for v in violations if v.type not in ["periodic", "screen_periodic"])
    tab_switches = sum(1 for v in violations if v.type == "tab_switch")
    voice_alerts = sum(1 for v in violations if v.type in ["voice_alert", "voice", "noise"])
    mobile_detections = sum(1 for v in violations if v.type == "mobile_phone")
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Question", "Selected Answer", "Correct Answer", "Is Correct",
        "Time Spent", "Violation Count", "Tab Switches", "Voice Alerts", "Mobile Detections"
    ])
    
    for q in questions:
        q_id = str(q.get("id"))
        q_type = q.get("type")
        correct_ans = q.get("correct_answer")
        
        candidate_ans = answers.get(q_id)
        
        if isinstance(candidate_ans, list):
            selected_str = "; ".join(str(x) for x in candidate_ans)
        else:
            selected_str = str(candidate_ans) if candidate_ans is not None else ""
            
        if isinstance(correct_ans, list):
            correct_str = "; ".join(str(x) for x in correct_ans)
        else:
            correct_str = str(correct_ans) if correct_ans is not None else ""
            
        is_correct = "False"
        if candidate_ans is not None:
            if q_type in ["mcq", "truefalse", "code_output_mcq"]:
                if str(candidate_ans).strip().lower() == str(correct_ans).strip().lower():
                    is_correct = "True"
            elif q_type == "multiselect":
                if isinstance(candidate_ans, list) and isinstance(correct_ans, list):
                    if sorted([str(x).strip().lower() for x in candidate_ans]) == sorted([str(x).strip().lower() for x in correct_ans]):
                        is_correct = "True"
                elif isinstance(candidate_ans, list):
                    correct_list = [str(x).strip().lower() for x in (correct_ans if isinstance(correct_ans, list) else str(correct_ans).split(";"))]
                    if sorted([str(x).strip().lower() for x in candidate_ans]) == sorted(correct_list):
                        is_correct = "True"
                else:
                    if str(candidate_ans).strip().lower() == str(correct_ans).strip().lower():
                        is_correct = "True"
            elif q_type == "coding":
                submission = db.query(models.CodeSubmission).filter(
                    models.CodeSubmission.attempt_id == attempt_id,
                    models.CodeSubmission.question_id == int(q_id),
                    models.CodeSubmission.is_draft == False
                ).first()
                if submission:
                    selected_str = submission.source_code
                    is_correct = "True" if submission.passed_cases == submission.total_cases and submission.total_cases > 0 else "False"
                    if submission.total_cases == 0 and submission.score > 0:
                        is_correct = "True"
            elif q_type == "descriptive":
                if candidate_ans and len(str(candidate_ans).strip()) > 10:
                    is_correct = "True"
                    
        writer.writerow([
            escape_csv_field(q.get("title", "")),
            escape_csv_field(selected_str),
            escape_csv_field(correct_str),
            escape_csv_field(is_correct),
            "N/A", 
            escape_csv_field(str(violation_count)),
            escape_csv_field(str(tab_switches)),
            escape_csv_field(str(voice_alerts)),
            escape_csv_field(str(mobile_detections))
        ])
        
    output.seek(0)
    user_name = attempt.user.name if attempt.user else "candidate"
    filename = f"attempt_report_{user_name.lower().replace(' ', '_')}_{attempt_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/institute/{institute_id}/csv")
def get_institute_report_csv(
    institute_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    institute = db.query(models.Institute).filter(models.Institute.id == institute_id).first()
    if not institute:
        raise HTTPException(status_code=404, detail="Institute not found")
        
    attempts = db.query(models.Attempt).options(
        joinedload(models.Attempt.user),
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).join(models.User).filter(
        models.User.institute_id == institute_id
    ).all()
    
    violation_counts = db.query(
        models.Violation.attempt_id, func.count(models.Violation.id)
    ).join(models.Attempt).join(models.User).filter(
        models.User.institute_id == institute_id,
        models.Violation.type != "periodic",
        models.Violation.type != "screen_periodic"
    ).group_by(models.Violation.attempt_id).all()
    violation_count_map = {att_id: count for att_id, count in violation_counts}
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Candidate Name", "Email", "Assessment", "Score",
        "Started At", "Submitted At", "Violations", "Duration", "Status"
    ])
    
    for a in attempts:
        user = a.user
        assess_name = a.snapshot.snapshot_data.get("name", a.snapshot.assessment.name) if a.snapshot else ""
        
        violation_count = violation_count_map.get(a.id, 0)
        
        duration_str = ""
        if a.completed_at:
            duration_str = f"{round((a.completed_at - a.started_at).total_seconds() / 60, 1)} min"
            
        score_str = str(a.score) if a.score is not None else ""
        started_at_str = a.started_at.strftime("%Y-%m-%d %H:%M:%S") if a.started_at else ""
        completed_at_str = a.completed_at.strftime("%Y-%m-%d %H:%M:%S") if a.completed_at else ""
        
        writer.writerow([
            escape_csv_field(user.name if user else "Unknown"),
            escape_csv_field(user.email if user else ""),
            escape_csv_field(assess_name),
            escape_csv_field(score_str),
            escape_csv_field(started_at_str),
            escape_csv_field(completed_at_str),
            escape_csv_field(str(violation_count)),
            escape_csv_field(duration_str),
            escape_csv_field(a.status)
        ])
        
    output.seek(0)
    filename = f"bulk_report_institute_{institute.name.lower().replace(' ', '_')}_{institute_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/all/csv")
def get_all_reports_csv(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    import csv
    import io
    from fastapi.responses import StreamingResponse

    attempts = db.query(models.Attempt).options(
        joinedload(models.Attempt.user).joinedload(models.User.institute),
        joinedload(models.Attempt.snapshot).joinedload(models.AssessmentSnapshot.assessment)
    ).all()
    
    violation_counts = db.query(
        models.Violation.attempt_id, func.count(models.Violation.id)
    ).filter(
        models.Violation.type != "periodic",
        models.Violation.type != "screen_periodic"
    ).group_by(models.Violation.attempt_id).all()
    violation_count_map = {att_id: count for att_id, count in violation_counts}
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Candidate Name", "Email", "Institute", "Assessment", "Score",
        "Started At", "Submitted At", "Violations", "Duration", "Status"
    ])
    
    for a in attempts:
        user = a.user
        institute_name = user.institute.name if user and user.institute else "Direct to Candidates"
        assess_name = a.snapshot.snapshot_data.get("name", a.snapshot.assessment.name) if a.snapshot else ""
        
        violation_count = violation_count_map.get(a.id, 0)
        
        duration_str = ""
        if a.completed_at:
            duration_str = f"{round((a.completed_at - a.started_at).total_seconds() / 60, 1)} min"
            
        score_str = str(a.score) if a.score is not None else ""
        started_at_str = a.started_at.strftime("%Y-%m-%d %H:%M:%S") if a.started_at else ""
        completed_at_str = a.completed_at.strftime("%Y-%m-%d %H:%M:%S") if a.completed_at else ""
        
        writer.writerow([
            escape_csv_field(user.name if user else "Unknown"),
            escape_csv_field(user.email if user else ""),
            escape_csv_field(institute_name),
            escape_csv_field(assess_name),
            escape_csv_field(score_str),
            escape_csv_field(started_at_str),
            escape_csv_field(completed_at_str),
            escape_csv_field(str(violation_count)),
            escape_csv_field(duration_str),
            escape_csv_field(a.status)
        ])
        
    output.seek(0)
    filename = "all_attempts_reports.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

