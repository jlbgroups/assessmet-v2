import os
import logging
import asyncio
import datetime
from typing import Optional, List, Dict, Any
from fastapi import BackgroundTasks
from database import BgSessionLocal
import models
from services.code_execution import CodeExecutionService

logger = logging.getLogger(__name__)

GRADING_CONCURRENCY = int(os.getenv("GRADING_CONCURRENCY", "4"))
GRADING_SEMAPHORE = asyncio.Semaphore(GRADING_CONCURRENCY)

async def _grade_coding_jobs_task(attempt_id: int, base_score: int, coding_jobs: List[Dict[str, Any]]):
    async with GRADING_SEMAPHORE:
        execution_service = CodeExecutionService()
        final_score = base_score

        for job in coding_jobs:
            with BgSessionLocal() as grading_db:
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
                    logger.error(f"Coding grading failed for attempt {attempt_id}, question {job['question_id']}: {exc}")
                    try:
                        grading_db.rollback()
                    except Exception:
                        pass

        with BgSessionLocal() as update_db:
            try:
                attempt = update_db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
                if attempt:
                    attempt.score = final_score
                    update_db.commit()
                    logger.info(f"Finalized coding grades for attempt {attempt_id}. Score: {final_score}")
            except Exception as e:
                update_db.rollback()
                logger.error(f"Failed to finalize attempt {attempt_id} score: {e}")

def _log_login_audit_task(user_id: Optional[int], email: str, action: str, details: str, ip_address: Optional[str], user_agent: Optional[str]):
    try:
        with BgSessionLocal() as db:
            try:
                db_log = models.AuditLog(
                    user_id=user_id,
                    email=email,
                    action=action,
                    details=details,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                db.add(db_log)
                db.commit()
                logger.info(f"Audit log saved: {action} for {email}")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to write audit log inside transaction: {e}")
    except Exception as outer_err:
        logger.error(f"Severe error in background audit task: {outer_err}")

def _log_violation_event_task(attempt_id: int, violation_type: str, severity: str, details: str, screenshot_path: Optional[str] = None):
    try:
        with BgSessionLocal() as db:
            try:
                db_violation = models.Violation(
                    attempt_id=attempt_id,
                    type=violation_type,
                    severity=severity,
                    details=details,
                    screenshot_path=screenshot_path
                )
                db.add(db_violation)
                db.commit()
                logger.info(f"Violation persisted asynchronously: {violation_type} for attempt {attempt_id}")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to write violation inside transaction: {e}")
    except Exception as outer_err:
        logger.error(f"Severe error in background violation log task: {outer_err}")

def _log_screenshot_violation_task(attempt_id: int, violation_type: str, severity: str, details: str, screenshot_path: str):
    recent_time = datetime.datetime.utcnow() - datetime.timedelta(seconds=10)
    try:
        with BgSessionLocal() as db:
            try:
                recent_violation = db.query(models.Violation).filter(
                    models.Violation.attempt_id == attempt_id,
                    models.Violation.type == violation_type,
                    models.Violation.timestamp >= recent_time
                ).order_by(models.Violation.timestamp.desc()).first()

                if recent_violation:
                    recent_violation.screenshot_path = screenshot_path
                else:
                    db_violation = models.Violation(
                        attempt_id=attempt_id,
                        type=violation_type,
                        severity=severity,
                        screenshot_path=screenshot_path,
                        details=details
                    )
                    db.add(db_violation)
                db.commit()
                logger.info(f"Screenshot violation persisted asynchronously: {violation_type} for attempt {attempt_id}")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to persist screenshot violation in db: {e}")
    except Exception as outer_err:
        logger.error(f"Severe error in background screenshot violation task: {outer_err}")

class TaskService:
    def queue_grade_coding_jobs(self, background_tasks: BackgroundTasks, attempt_id: int, base_score: int, coding_jobs: List[Dict[str, Any]]):
        background_tasks.add_task(_grade_coding_jobs_task, attempt_id, base_score, coding_jobs)

    def queue_login_audit(self, background_tasks: BackgroundTasks, user_id: Optional[int], email: str, action: str, details: str, ip_address: Optional[str], user_agent: Optional[str]):
        background_tasks.add_task(_log_login_audit_task, user_id, email, action, details, ip_address, user_agent)

    def queue_violation_log(self, background_tasks: BackgroundTasks, attempt_id: int, violation_type: str, severity: str, details: str, screenshot_path: Optional[str] = None):
        background_tasks.add_task(_log_violation_event_task, attempt_id, violation_type, severity, details, screenshot_path)

    def queue_screenshot_violation_log(self, background_tasks: BackgroundTasks, attempt_id: int, violation_type: str, severity: str, details: str, screenshot_path: str):
        background_tasks.add_task(_log_screenshot_violation_task, attempt_id, violation_type, severity, details, screenshot_path)

task_service = TaskService()
