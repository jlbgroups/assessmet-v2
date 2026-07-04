import time
import logging
from typing import List, Dict, Any, Union
from datetime import datetime
import asyncio
from sqlalchemy import func

logger = logging.getLogger(__name__)

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from database import SessionLocal, get_db
import models, schemas, auth
from routers.auth import get_current_admin, get_current_user
from services.tasks import task_service
from services.metrics import metrics_manager
from services.cache import cache_service

router = APIRouter(prefix="/assessments", tags=["Assessments"])
attempts_router = APIRouter(prefix="/attempts", tags=["Attempts"])


def build_question_snapshot_payload(question: models.Question) -> dict:
    return {
        "id": question.id,
        "assessment_id": question.assessment_id,
        "title": question.title,
        "type": question.type,
        "difficulty": question.difficulty,
        "marks": question.marks,
        "options": question.options,
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "allowed_languages": question.allowed_languages,
        "boilerplate": question.boilerplate,
        "starter_code": question.starter_code,
        "test_cases": [
            {
                "id": tc.id,
                "question_id": tc.question_id,
                "input_data": tc.input_data,
                "expected_output": tc.expected_output,
                "is_visible": tc.is_visible,
                "order_index": tc.order_index
            }
            for tc in question.test_cases
        ]
    }


def build_candidate_snapshot_data(snapshot_data: dict) -> dict:
    questions = []
    for question_data in snapshot_data.get("questions", []):
        candidate_question = {
            key: value
            for key, value in question_data.items()
            if key != "correct_answer"
        }
        if "test_cases" in candidate_question:
            candidate_question["test_cases"] = [
                {
                    "id": tc.get("id"),
                    "question_id": tc.get("question_id"),
                    "input_data": tc.get("input_data"),
                    "expected_output": tc.get("expected_output"),
                    "is_visible": tc.get("is_visible", True),
                    "order_index": tc.get("order_index"),
                }
                for tc in candidate_question["test_cases"]
                if tc.get("is_visible", True)
            ]
        questions.append(candidate_question)
    return {
        **snapshot_data,
        "questions": questions,
    }


def get_candidate_snapshot_data(snapshot: models.AssessmentSnapshot) -> dict:
    if snapshot.candidate_snapshot_data:
        return snapshot.candidate_snapshot_data
    return build_candidate_snapshot_data(snapshot.snapshot_data)


def build_submission_jobs(questions: List[dict], candidate_answers: Dict[str, Any]) -> tuple[int, List[Dict[str, Any]]]:
    base_score = 0
    coding_jobs: List[Dict[str, Any]] = []

    for question in questions:
        question_id = str(question.get("id"))
        question_type = question.get("type")
        correct_answer = question.get("correct_answer")
        marks = question.get("marks", 1)

        candidate_answer = candidate_answers.get(question_id)
        if candidate_answer is None:
            continue

        if question_type in ["mcq", "truefalse", "code_output_mcq"]:
            if str(candidate_answer).strip().lower() == str(correct_answer).strip().lower():
                base_score += marks
        elif question_type == "multiselect":
            if isinstance(candidate_answer, list) and isinstance(correct_answer, list):
                normalized_candidate = sorted(str(value).strip().lower() for value in candidate_answer)
                normalized_correct = sorted(str(value).strip().lower() for value in correct_answer)
                if normalized_candidate == normalized_correct:
                    base_score += marks
            elif str(candidate_answer).strip().lower() == str(correct_answer).strip().lower():
                base_score += marks
        elif question_type == "coding":
            source_code = ""
            language = "python"
            if isinstance(candidate_answer, dict):
                source_code = candidate_answer.get("source_code", "")
                language = candidate_answer.get("language", "python")
            elif isinstance(candidate_answer, str):
                source_code = candidate_answer
                allowed_languages = question.get("allowed_languages")
                if isinstance(allowed_languages, list) and allowed_languages:
                    language = allowed_languages[0]

            if source_code.strip():
                coding_jobs.append({
                    "question_id": int(question_id),
                    "language": language,
                    "source_code": source_code,
                })
        elif question_type == "descriptive":
            if candidate_answer and len(str(candidate_answer).strip()) > 10:
                base_score += int(marks / 2)

    return base_score, coding_jobs


async def finalize_coding_scores(attempt_id: int, base_score: int, coding_jobs: List[Dict[str, Any]]) -> None:
    from services.code_execution import CodeExecutionService

    execution_service = CodeExecutionService()
    final_score = base_score

    for job in coding_jobs:
        with SessionLocal() as grading_db:
            try:
                result = await execution_service.evaluate_hidden_tests(
                    db=grading_db,
                    attempt_id=attempt_id,
                    question_id=job["question_id"],
                    language=job["language"],
                    source_code=job["source_code"],
                )
                final_score += result["score"]
            except Exception as exc:
                print(f"Coding grading failed for attempt {attempt_id}, question {job['question_id']}: {exc}")
                grading_db.rollback()

    with SessionLocal() as update_db:
        attempt = update_db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
        if not attempt:
            return
        attempt.score = final_score
        update_db.commit()

def save_assessment_questions_and_test_cases(db: Session, assessment_id: int, questions_data: List[schemas.QuestionCreate]):
    db.query(models.Question).filter(models.Question.assessment_id == assessment_id).delete()
    db.flush()
    
    for q in questions_data:
        db_question = models.Question(
            assessment_id=assessment_id,
            title=q.title,
            type=q.type,
            difficulty=q.difficulty,
            marks=q.marks,
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            allowed_languages=q.allowed_languages,
            boilerplate=q.boilerplate,
            starter_code=q.starter_code
        )
        db.add(db_question)
        db.flush() 
        
        if q.type == "coding" and q.test_cases:
            for order_idx, tc in enumerate(q.test_cases):
                db_tc = models.CodingTestCase(
                    question_id=db_question.id,
                    input_data=tc.input_data,
                    expected_output=tc.expected_output,
                    is_visible=tc.is_visible if tc.is_visible is not None else True,
                    order_index=tc.order_index if tc.order_index is not None else order_idx
                )
                db.add(db_tc)

def create_assessment_snapshot_db(db: Session, assessment_id: int) -> models.AssessmentSnapshot:
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    questions = db.query(models.Question).options(
        selectinload(models.Question.test_cases)
    ).filter(models.Question.assessment_id == assessment_id).all()

    snapshot_data = {
        "id": assessment.id,
        "name": assessment.name,
        "description": assessment.description,
        "instructions": assessment.instructions,
        "duration_minutes": assessment.duration_minutes,
        "total_marks": assessment.total_marks,
        "passing_marks": assessment.passing_marks,
        "questions": [build_question_snapshot_payload(question) for question in questions]
    }
    candidate_snapshot_data = build_candidate_snapshot_data(snapshot_data)
    
    db_snapshot = models.AssessmentSnapshot(
        assessment_id=assessment_id,
        version=assessment.active_version,
        snapshot_data=snapshot_data,
        candidate_snapshot_data=candidate_snapshot_data,
    )
    db.add(db_snapshot)
    
    assessment.active_version += 1
    
    db.commit()
    db.refresh(db_snapshot)
    return db_snapshot


@router.get("", response_model=List[Union[schemas.AssessmentResponse, schemas.CandidateAssessmentResponse]])
def get_assessments(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "admin":
        assessments = db.query(models.Assessment).all()
        for a in assessments:
            a.user_attempt_status = None
            a.user_attempt_score = None
            a.user_attempt_id = None
        return assessments
    else:
        assignments = db.query(models.Assignment).options(
            joinedload(models.Assignment.assessment)
        ).filter(
            (models.Assignment.user_id == current_user.id) | 
            (models.Assignment.institute_id == current_user.institute_id)
        ).all()
        
        assigned_assessments = []
        assignment_map = {}
        for ass in assignments:
            if ass.assessment:
                assignment_map[ass.assessment_id] = ass
                assigned_assessments.append(ass.assessment)
        
        attempts = db.query(models.Attempt).options(
            joinedload(models.Attempt.snapshot)
        ).join(
            models.AssessmentSnapshot, models.AssessmentSnapshot.id == models.Attempt.assessment_snapshot_id
        ).filter(
            models.Attempt.user_id == current_user.id
        ).all()
        
        attempt_map = {}
        for att in attempts:
            attempt_map[att.snapshot.assessment_id] = att
            
        results = []
        for assess in assigned_assessments:
            att = attempt_map.get(assess.id)
            ass = assignment_map.get(assess.id)
            
            res_obj = schemas.CandidateAssessmentResponse.model_validate(assess)
            res_obj.user_attempt_status = att.status if att else None
            res_obj.user_attempt_score = att.score if att else None
            res_obj.user_attempt_id = att.id if att else None
            
            if ass:
                res_obj.role = ass.role
                res_obj.job_title = ass.job_title
                if ass.start_date:
                    res_obj.start_date = ass.start_date
                if ass.end_date:
                    res_obj.end_date = ass.end_date
            results.append(res_obj)
            
        return results


@router.get("/questions/past", response_model=List[schemas.QuestionResponse])
def get_past_questions(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    questions = db.query(models.Question).all()
    unique_questions = []
    seen = set()
    for q in questions:
        key = (q.title.strip().lower(), q.type)
        if key not in seen:
            seen.add(key)
            unique_questions.append(q)
    return unique_questions


@router.get("/{id}", response_model=schemas.AssessmentDetailResponse)
def get_assessment_detail(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    start = time.perf_counter()
    try:
        t_sql_start = time.perf_counter()
        
        start_date = None
        end_date = None
        if current_user.role != "admin":
            assigned = db.query(models.Assignment).filter(
                models.Assignment.assessment_id == id,
                (models.Assignment.user_id == current_user.id) | (models.Assignment.institute_id == current_user.institute_id)
            ).first()
            
            if not assigned:
                exists = db.query(models.Assessment.id).filter(models.Assessment.id == id).first()
                if not exists:
                    raise HTTPException(status_code=404, detail="Assessment not found")
                raise HTTPException(status_code=403, detail="Access to this assessment is not authorized")
                
            start_date = assigned.start_date
            end_date = assigned.end_date

        cache_key = f"assessment_detail:{id}:{current_user.role}"
        cached_res = cache_service.get(cache_key)
        if cached_res:
            db.close()
            if current_user.role != "admin":
                res_dict = cached_res.model_dump()
                if start_date is not None:
                    res_dict["start_date"] = start_date
                if end_date is not None:
                    res_dict["end_date"] = end_date
                return schemas.AssessmentDetailResponse.model_validate(res_dict)
            return cached_res

        if current_user.role != "admin":
            assessment = db.query(models.Assessment).options(
                selectinload(models.Assessment.snapshots)
            ).filter(models.Assessment.id == id).first()
            
            if not assessment:
                raise HTTPException(status_code=404, detail="Assessment not found")

            metrics_manager.set_gauge("assessment_sql", time.perf_counter() - t_sql_start)

            t_render_start = time.perf_counter()
            res = schemas.AssessmentDetailResponse.model_validate(assessment)
            
            snapshots = assessment.snapshots
            latest_snapshot = None
            if snapshots:
                latest_snapshot = max(snapshots, key=lambda s: s.version)
                
            if not latest_snapshot:
                latest_snapshot = create_assessment_snapshot_db(db, id)
                
            candidate_snapshot = get_candidate_snapshot_data(latest_snapshot)
            res.questions = [
                schemas.QuestionResponse.model_validate(question)
                for question in candidate_snapshot.get("questions", [])
            ]
            
            if start_date is not None:
                res.start_date = start_date
            if end_date is not None:
                res.end_date = end_date
            metrics_manager.set_gauge("assessment_render", time.perf_counter() - t_render_start)
        else:
            assessment = db.query(models.Assessment).options(
                selectinload(models.Assessment.questions).selectinload(models.Question.test_cases)
            ).filter(models.Assessment.id == id).first()
            
            if not assessment:
                raise HTTPException(status_code=404, detail="Assessment not found")
                
            metrics_manager.set_gauge("assessment_sql", time.perf_counter() - t_sql_start)

            t_render_start = time.perf_counter()
            res = schemas.AssessmentDetailResponse.model_validate(assessment)
            res.questions = [schemas.QuestionResponse.model_validate(question) for question in assessment.questions]
            metrics_manager.set_gauge("assessment_render", time.perf_counter() - t_render_start)
            
        cache_service.set(cache_key, res)
        db.close()
        return res
    finally:
        logger.info(
            "get_assessment took %.3f",
            time.perf_counter() - start
        )


@router.post("", response_model=schemas.AssessmentResponse)
def create_assessment(assess_data: schemas.AssessmentCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    calculated_total_marks = sum(q.marks for q in assess_data.questions)
    db_assess = models.Assessment(
        name=assess_data.name,
        description=assess_data.description,
        instructions=assess_data.instructions,
        duration_minutes=assess_data.duration_minutes,
        total_marks=calculated_total_marks,
        passing_marks=assess_data.passing_marks,
        start_date=assess_data.start_date or datetime(2000, 1, 1),
        end_date=assess_data.end_date or datetime(2100, 1, 1),
        active_version=1
    )
    db.add(db_assess)
    db.commit()
    db.refresh(db_assess)
    
    save_assessment_questions_and_test_cases(db, db_assess.id, assess_data.questions)
    db.commit()
    
    create_assessment_snapshot_db(db, db_assess.id)
    
    cache_service.invalidate(f"assessment_detail:{db_assess.id}:admin")
    cache_service.invalidate(f"assessment_detail:{db_assess.id}:candidate")
    
    return db_assess


@router.put("/{id}", response_model=schemas.AssessmentResponse)
def update_assessment(id: int, assess_data: schemas.AssessmentCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_assess = db.query(models.Assessment).filter(models.Assessment.id == id).first()
    if not db_assess:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    db_assess.name = assess_data.name
    db_assess.description = assess_data.description
    db_assess.instructions = assess_data.instructions
    db_assess.duration_minutes = assess_data.duration_minutes
    calculated_total_marks = sum(q.marks for q in assess_data.questions)
    db_assess.total_marks = calculated_total_marks
    db_assess.passing_marks = assess_data.passing_marks
    db_assess.start_date = assess_data.start_date or datetime(2000, 1, 1)
    db_assess.end_date = assess_data.end_date or datetime(2100, 1, 1)
    
    save_assessment_questions_and_test_cases(db, id, assess_data.questions)
    db.commit()
    
    create_assessment_snapshot_db(db, id)
    db.refresh(db_assess)
    
    cache_service.invalidate(f"assessment_detail:{id}:admin")
    cache_service.invalidate(f"assessment_detail:{id}:candidate")
    
    return db_assess


@router.delete("/{id}")
def delete_assessment(id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_assess = db.query(models.Assessment).filter(models.Assessment.id == id).first()
    if not db_assess:
        raise HTTPException(status_code=404, detail="Assessment not found")
    db.delete(db_assess)
    db.commit()
    
    cache_service.invalidate(f"assessment_detail:{id}:admin")
    cache_service.invalidate(f"assessment_detail:{id}:candidate")
    
    return {"detail": "Assessment successfully deleted"}


@router.post("/{id}/assign")
def assign_assessment(id: int, assign_data: Dict[str, Any], db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    assessment = db.query(models.Assessment).filter(models.Assessment.id == id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    institute_id = assign_data.get("institute_id")
    user_id = assign_data.get("user_id")
    start_date_str = assign_data.get("start_date")
    end_date_str = assign_data.get("end_date")
    role = assign_data.get("role")
    job_title = assign_data.get("job_title")
    
    if not institute_id and not user_id:
        raise HTTPException(status_code=400, detail="Either institute_id or user_id must be provided")
        
    dup = db.query(models.Assignment).filter(
        models.Assignment.assessment_id == id,
        models.Assignment.institute_id == institute_id,
        models.Assignment.user_id == user_id
    ).first()
    
    start_date = None
    end_date = None
    if start_date_str:
        try:
            from dateutil.parser import parse
            start_date = parse(start_date_str)
        except Exception:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid start_date format")
    if end_date_str:
        try:
            from dateutil.parser import parse
            end_date = parse(end_date_str)
        except Exception:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid end_date format")
                
    if dup:
        dup.start_date = start_date
        dup.end_date = end_date
        dup.role = role
        dup.job_title = job_title
        db.commit()
        return {"detail": "Already assigned, updated active start/end window"}
        
    db_assign = models.Assignment(
        assessment_id=id,
        institute_id=institute_id,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        role=role,
        job_title=job_title
    )
    db.add(db_assign)
    db.commit()
    return {"detail": "Assessment successfully assigned"}

@router.post("/{id}/bulk-auto-assign")
def bulk_auto_assign(
    id: int,
    payload: schemas.BulkAutoAssignRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    assessment = (
        db.query(models.Assessment)
        .filter(models.Assessment.id == id)
        .first()
        )
    if not assessment:
        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )
    institute = (
        db.query(models.Institute)
        .filter(models.Institute.id == payload.institute_id)
        .first()
    )
    if not institute:
        raise HTTPException(
            status_code=404,
            detail="Institute not found"
            )
    existing_batch = (
        db.query(models.BulkAssignmentBatch)
        .filter(
            models.BulkAssignmentBatch.assessment_id == id,
            models.BulkAssignmentBatch.institute_id == payload.institute_id,
            models.BulkAssignmentBatch.range_start == payload.from_serial,
            models.BulkAssignmentBatch.range_end == payload.to_serial,
        )
        .first()
    )

    if existing_batch:
        raise HTTPException(
            status_code=400,
            detail=f"Range {payload.from_serial}-{payload.to_serial} is already assigned."
        )
    already_assigned_ids = (
        db.query(models.Assignment.user_id)
        .filter(
            models.Assignment.institute_id == payload.institute_id,
            models.Assignment.user_id.isnot(None)
            )
        .distinct()
        .all()
        )
    already_assigned_ids = [
        row[0]
        for row in already_assigned_ids
    ]
    
    
    students_query = (
        db.query(models.User)
        .filter(
            models.User.institute_id == payload.institute_id,
            models.User.role == "candidate",
            models.User.status == "active",
            )
        )
    # if already_assigned_ids:
    #     students_query = students_query.filter(
    #         ~models.User.id.in_(already_assigned_ids)
    #     )
    count = payload.to_serial - payload.from_serial + 1
    students = (
        students_query
        .order_by(models.User.name.asc())
        .offset(payload.from_serial - 1)
        .limit(count)
        .all()
    )
    existing_batch = (
        db.query(models.BulkAssignmentBatch)
        .filter(
            models.BulkAssignmentBatch.assessment_id == id,
            models.BulkAssignmentBatch.institute_id == payload.institute_id,
            models.BulkAssignmentBatch.range_start <= payload.to_serial,
            models.BulkAssignmentBatch.range_end >= payload.from_serial
        )
        .first()
    )
    if existing_batch:
        raise HTTPException(
            status_code=400,
            detail=f"Range {payload.from_serial}-{payload.to_serial} overlaps with an existing batch range {existing_batch.range_start}-{existing_batch.range_end}."
        )
    if not students:
        return{
            "message": "No students remaining for assignment.",
            "assigned_count": 0,
            "remaining_students": 0
        }
    batch = models.BulkAssignmentBatch(
        assessment_id=id,
        institute_id=payload.institute_id,
        assigned_count = count,
        first_student_id=students[0].id if students else None,
        last_student_id=students[-1].id if students else None,
        range_start=payload.from_serial,
        range_end=payload.to_serial,
        created_by=admin.id
    )
    db.add(batch)
    db.flush()
    for student in students:
        db_assign = models.Assignment(
            assessment_id=id,
            institute_id=payload.institute_id,
            user_id=student.id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            role=payload.role,
            job_title=payload.job_title,
            batch_id=batch.id
        )
        db.add(db_assign)
    db.commit()
    total_students = (
        db.query(models.User).filter(
        models.User.institute_id == payload.institute_id,
        models.User.role == "candidate",
        models.User.status == "active"
    ).count()
    )
    already_assigned_count = (
        db.query(
        func.coalesce(
            func.sum(models.BulkAssignmentBatch.assigned_count),
            0
        )
    )
    .filter(
        models.BulkAssignmentBatch.institute_id == payload.institute_id
    )
    .scalar()
    )
    remaining_students = ( total_students - already_assigned_count
    )
    return {
    "message": "Bulk assignment completed successfully.",
    "batch": {
        "id": batch.id,
        "assessment_id": assessment.id,
        "assigned_at" : batch.created_at
        },
    "assessment": assessment.name,
    "assigned_count": len(students),
    "total_students": total_students,
    "already_assigned": already_assigned_count,
    "progress": {"assigned": already_assigned_count + len(students), "total": total_students},
    "range": {"start": already_assigned_count + 1,"end": already_assigned_count + len(students)},
    "next_assignment_start":already_assigned_count + 1,
    "next_assignment_end":already_assigned_count + len(students),
    "remaining_students": remaining_students,
    "first_student": students[0].name,
    "last_student": students[-1].name,
    "assigned_students": [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email
        }
        for s in students
    ]

}
    
@router.get("/institutes/{institute_id}/assignment-history")
def get_assignment_history(
    institute_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
    ):
    institute = (
        db.query(models.Institute)
        .filter(models.Institute.id == institute_id)
        .first()
    )
    if not institute:
        raise HTTPException(
            status_code=404,
            detail="Institute not found"
        )
    assignments = (
        db.query(models.Assignment)
        .filter(models.Assignment.institute_id == institute_id)
        .order_by(models.Assignment.created_at.desc())
        .all()
    )
    return assignments

@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_assign = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not db_assign:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    db.delete(db_assign)
    db.commit()
    return {"detail": "Assignment successfully removed"}

@router.post("/{id}/start", response_model=schemas.AttemptStartResponse)
def start_assessment(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    start = time.perf_counter()
    try:
        active_attempt = db.query(models.Attempt).options(
            joinedload(models.Attempt.snapshot),
            selectinload(models.Attempt.session_tokens)
        ).join(
            models.AssessmentSnapshot, models.AssessmentSnapshot.id == models.Attempt.assessment_snapshot_id
        ).filter(
            models.Attempt.user_id == current_user.id,
            models.AssessmentSnapshot.assessment_id == id,
            models.Attempt.status == "active"
        ).first()
        
        if active_attempt:
            snapshot = active_attempt.snapshot
            token_db = active_attempt.session_tokens[0] if active_attempt.session_tokens else None
            if token_db and token_db.expires_at > datetime.utcnow():
                session_token = token_db.token
            else:
                session_token = auth.add_exam_session_token_record(db, active_attempt.id)
                db.commit()
                
            snapshot_data = snapshot.snapshot_data if current_user.role == "admin" else get_candidate_snapshot_data(snapshot)

            res = {
                "attempt": active_attempt,
                "exam_session_token": session_token,
                "snapshot_data": snapshot_data
            }
            res_validated = schemas.AttemptStartResponse.model_validate(res)
            db.close()
            return res_validated
            
        if current_user.role != "admin":
            assigned = db.query(models.Assignment).options(
                joinedload(models.Assignment.assessment).selectinload(models.Assessment.snapshots)
            ).filter(
                (models.Assignment.assessment_id == id) &
                ((models.Assignment.user_id == current_user.id) | (models.Assignment.institute_id == current_user.institute_id))
            ).first()
            if not assigned:
                raise HTTPException(status_code=403, detail="Not assigned to this assessment")
            assessment = assigned.assessment
        else:
            assessment = db.query(models.Assessment).options(
                selectinload(models.Assessment.snapshots)
            ).filter(models.Assessment.id == id).first()
            if not assessment:
                raise HTTPException(status_code=404, detail="Assessment not found")
                
        latest_snapshot = None
        if assessment.snapshots:
            latest_snapshot = max(assessment.snapshots, key=lambda s: s.version)
            
        if not latest_snapshot:
            latest_snapshot = create_assessment_snapshot_db(db, id)

        try:
            db_attempt = models.Attempt(
                user_id=current_user.id,
                assessment_snapshot_id=latest_snapshot.id,
                status="active",
                system_check_passed=False
            )
            db.add(db_attempt)
            db.flush()
            session_token = auth.add_exam_session_token_record(db, db_attempt.id)
            db.commit()
            db.refresh(db_attempt)
        except Exception:
            db.rollback()
            raise

        snapshot_data = latest_snapshot.snapshot_data if current_user.role == "admin" else get_candidate_snapshot_data(latest_snapshot)

        res = {
            "attempt": db_attempt,
            "exam_session_token": session_token,
            "snapshot_data": snapshot_data
        }
        res_validated = schemas.AttemptStartResponse.model_validate(res)
        db.close()
        return res_validated
    finally:
        logger.info(
            "start_assessment took %.3f",
            time.perf_counter() - start
        )


@router.post("/{id}/submit", status_code=status.HTTP_202_ACCEPTED)
async def submit_assessment(id: int, submit_data: schemas.AttemptSubmitRequest, exam_session_token: str, attempt_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    start = time.perf_counter()
    try:
        import datetime
        attempt = db.query(models.Attempt).options(
            joinedload(models.Attempt.snapshot),
            selectinload(models.Attempt.session_tokens)
        ).filter(
            models.Attempt.id == attempt_id,
            models.Attempt.status == "active"
        ).first()
        
        if not attempt:
            raise HTTPException(status_code=404, detail="Active exam attempt not found")
            
        valid_token = None
        for tok in attempt.session_tokens:
            if tok.token == exam_session_token and tok.expires_at > datetime.datetime.utcnow():
                valid_token = tok
                break
                
        if not valid_token:
            raise HTTPException(status_code=401, detail="Invalid or expired exam session token")
            
        snapshot = attempt.snapshot
        questions = snapshot.snapshot_data.get("questions", [])
        candidate_answers = submit_data.answers
        base_score, coding_jobs = build_submission_jobs(questions, candidate_answers)

        t_db_start = time.perf_counter()
        attempt.status = "completed"
        attempt.completed_at = datetime.datetime.utcnow()
        attempt.score = base_score if not coding_jobs else None
        attempt.answers_data = candidate_answers
        
        db.delete(valid_token)
        db.commit()
        
        total_marks = snapshot.snapshot_data.get("total_marks")
        passing_marks = snapshot.snapshot_data.get("passing_marks")
        
        db.close()
        
        metrics_manager.set_gauge("submit_db", time.perf_counter() - t_db_start)

        t_bg_start = time.perf_counter()
        if coding_jobs:
            task_service.queue_grade_coding_jobs(background_tasks, attempt_id, base_score, coding_jobs)
        metrics_manager.set_gauge("submit_background", time.perf_counter() - t_bg_start)
        
        return {
            "detail": "Exam submitted successfully" if not coding_jobs else "Exam submitted successfully. Coding answers are being graded in the background.",
            "score": base_score if not coding_jobs else None,
            "total_marks": total_marks,
            "passing_marks": passing_marks,
            "grading_status": "completed" if not coding_jobs else "pending",
        }
    finally:
        logger.info(
            "submit_assessment took %.3f",
            time.perf_counter() - start
        )


@attempts_router.post("/{attempt_id}/feedback")
def submit_feedback(attempt_id: int, feedback_data: schemas.FeedbackSubmit, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    if attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to submit feedback for this attempt")
        
    if attempt.feedback_rating is not None:
        raise HTTPException(status_code=400, detail="Feedback already submitted")
        
    if attempt.status != "completed":
        raise HTTPException(status_code=400, detail="Cannot submit feedback for an incomplete exam")
        
    attempt.feedback_rating = feedback_data.rating
    attempt.feedback_comments = feedback_data.comments
    db.commit()
    return {"detail": "Feedback submitted successfully"}
