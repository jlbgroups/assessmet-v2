import re
import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import models, schemas
from clients.jdoodle import JDoodleClient

class CodeExecutionService:
    def __init__(self):
        self.client = JDoodleClient()

    @staticmethod
    def compare_outputs(actual: str, expected: str) -> bool:
        
        act_norm = actual.replace("\r\n", "\n").strip()
        exp_norm = expected.replace("\r\n", "\n").strip()

        act_lines = [line.strip() for line in act_norm.split("\n") if line.strip()]
        exp_lines = [line.strip() for line in exp_norm.split("\n") if line.strip()]

        if len(act_lines) != len(exp_lines):
            return False

        for act_l, exp_l in zip(act_lines, exp_lines):
            act_l_clean = re.sub(r'\s+', ' ', act_l)
            exp_l_clean = re.sub(r'\s+', ' ', exp_l)

            if act_l_clean == exp_l_clean:
                continue

            act_tokens = act_l_clean.split()
            exp_tokens = exp_l_clean.split()
            
            if len(act_tokens) != len(exp_tokens):
                return False

            tokens_match = True
            for at, et in zip(act_tokens, exp_tokens):
                if at == et:
                    continue
                try:
                    val_a = float(at)
                    val_b = float(et)
                    if abs(val_a - val_b) >= 1e-6:
                        tokens_match = False
                        break
                except ValueError:
                    tokens_match = False
                    break

            if tokens_match:
                continue

            return False

        return True

    def get_or_create_telemetry(self, db: Session, attempt_id: int, question_id: int) -> models.CodingTelemetry:
        telemetry = db.query(models.CodingTelemetry).filter(
            models.CodingTelemetry.attempt_id == attempt_id,
            models.CodingTelemetry.question_id == question_id
        ).first()
        if not telemetry:
            telemetry = models.CodingTelemetry(
                attempt_id=attempt_id,
                question_id=question_id,
                run_count=0,
                paste_count=0,
                large_paste_count=0,
                compile_errors=0
            )
            db.add(telemetry)
            db.commit()
            db.refresh(telemetry)
        return telemetry

    async def run_visible_tests(
        self, db: Session, attempt_id: int, question_id: int, language: str, source_code: str
    ) -> schemas.CodeRunResponse:
        attempt = db.query(models.Attempt).filter(
            models.Attempt.id == attempt_id, models.Attempt.status == "active"
        ).first()
        if not attempt:
            raise HTTPException(status_code=400, detail="Active exam attempt not found.")

        telemetry = db.query(models.CodingTelemetry).filter(
            models.CodingTelemetry.attempt_id == attempt_id,
            models.CodingTelemetry.question_id == question_id
        ).first()
        run_count = telemetry.run_count if telemetry else 0

        if run_count >= 30:
            raise HTTPException(
                status_code=429,
                detail="Run limit exceeded. Maximum 30 run requests per question allowed."
            )

        visible_cases = db.query(models.CodingTestCase).filter(
            models.CodingTestCase.question_id == question_id,
            models.CodingTestCase.is_visible == True
        ).order_by(models.CodingTestCase.order_index.asc()).all()

        if not visible_cases:
            question = db.query(models.Question).filter(models.Question.id == question_id).first()
            if question and question.options and isinstance(question.options, dict):
                test_cases_backup = question.options.get("test_cases", [])
                visible_cases = [
                    models.CodingTestCase(
                        input_data=tc.get("input", ""),
                        expected_output=tc.get("output", ""),
                        is_visible=True
                    ) for tc in test_cases_backup
                ]

        if not visible_cases:
            raise HTTPException(status_code=400, detail="No visible test cases found for this question.")

        submissions = [
            {
                "source_code": source_code,
                "language": language,
                "stdin": case.input_data or ""
            }
            for case in visible_cases
        ]

        db.close()

        results = await self.client.execute_batch(submissions)

        first_result = results[0] if results else {}
        
        if isinstance(first_result, Exception):
            return schemas.CodeRunResponse(
                stdout="",
                stderr=str(first_result),
                compile_output="",
                execution_time=0.0,
                memory_used=0.0,
                exit_code=1,
                status="Error",
                passed=False
            )

        stdout = first_result.get("output") or ""
        stderr = first_result.get("error") or ""
        comp_status = first_result.get("compilationStatus")
        
        cpu_time = 0.0
        if first_result.get("cpuTime") is not None:
            try:
                cpu_time = float(first_result["cpuTime"])
            except ValueError:
                pass
                
        mem_used = 0.0
        if first_result.get("memory") is not None:
            try:
                mem_used = float(first_result["memory"])
            except ValueError:
                pass

        is_compile_error = comp_status is not None and str(comp_status) != "0"
        is_timeout = "timeout" in stdout.lower() or "timeout" in stderr.lower()

        if is_compile_error:
            status_desc = "Compilation Error"
            compile_output = stdout
            stdout = ""
            exit_code = 1
        elif is_timeout:
            status_desc = "Time Limit Exceeded"
            compile_output = ""
            exit_code = 124
        else:
            status_desc = "Accepted"
            compile_output = ""
            exit_code = 0

        all_passed = True
        for case, res in zip(visible_cases, results):
            if isinstance(res, Exception):
                all_passed = False
                break
                
            res_output = res.get("output") or ""
            res_error = res.get("error") or ""
            res_comp = res.get("compilationStatus")
            
            res_is_compile = res_comp is not None and str(res_comp) != "0"
            res_is_timeout = "timeout" in res_output.lower() or "timeout" in res_error.lower()
            
            if res_is_compile or res_is_timeout:
                all_passed = False
                break
            if not self.compare_outputs(res_output, case.expected_output):
                all_passed = False
                break

        from database import BgSessionLocal
        with BgSessionLocal() as write_db:
            telemetry = write_db.query(models.CodingTelemetry).filter(
                models.CodingTelemetry.attempt_id == attempt_id,
                models.CodingTelemetry.question_id == question_id
            ).first()
            if not telemetry:
                telemetry = models.CodingTelemetry(
                    attempt_id=attempt_id,
                    question_id=question_id,
                    run_count=0,
                    paste_count=0,
                    large_paste_count=0,
                    compile_errors=0
                )
                write_db.add(telemetry)
            
            telemetry.run_count += 1
            if is_compile_error:
                telemetry.compile_errors += 1
            write_db.commit()

        return schemas.CodeRunResponse(
            stdout=stdout,
            stderr=stderr,
            compile_output=compile_output,
            execution_time=cpu_time,
            memory_used=mem_used,
            exit_code=exit_code,
            status=status_desc,
            passed=all_passed
        )

    async def evaluate_hidden_tests(
        self, db: Session, attempt_id: int, question_id: int, language: str, source_code: str
    ) -> Dict[str, Any]:
       
        question = db.query(models.Question).filter(models.Question.id == question_id).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found.")

        all_cases = db.query(models.CodingTestCase).filter(
            models.CodingTestCase.question_id == question_id
        ).order_by(models.CodingTestCase.order_index.asc()).all()

        if not all_cases:
            if question.options and isinstance(question.options, dict):
                test_cases_backup = question.options.get("test_cases", [])
                all_cases = [
                    models.CodingTestCase(
                        input_data=tc.get("input", ""),
                        expected_output=tc.get("output", ""),
                        is_visible=True
                    ) for tc in test_cases_backup
                ]

        question_marks = question.marks
        db.close()

        if not all_cases:
            return {"score": question_marks, "passed_cases": 0, "total_cases": 0}

        submissions = [
            {
                "source_code": source_code,
                "language": language,
                "stdin": case.input_data or ""
            }
            for case in all_cases
        ]

        results = await self.client.execute_batch(submissions)

        passed_count = 0
        total_count = len(all_cases)
        
        failed_stdout = None
        failed_stderr = None
        failed_compile = None
        failed_time = 0.0
        failed_memory = 0.0
        failed_exit_code = 0
        failed_status = "Accepted"

        for idx, (case, res) in enumerate(zip(all_cases, results)):
            if isinstance(res, Exception):
                res_output = ""
                res_error = str(res)
                res_comp = "1"
                res_time = 0.0
                res_mem = 0.0
            else:
                res_output = res.get("output") or ""
                res_error = res.get("error") or ""
                res_comp = res.get("compilationStatus")
                
                try:
                    res_time = float(res.get("cpuTime") or 0.0)
                except ValueError:
                    res_time = 0.0
                try:
                    res_mem = float(res.get("memory") or 0.0)
                except ValueError:
                    res_mem = 0.0

            res_is_compile = res_comp is not None and str(res_comp) != "0"
            res_is_timeout = "timeout" in res_output.lower() or "timeout" in res_error.lower()

            if res_is_compile or res_is_timeout:
                is_correct = False
            else:
                is_correct = self.compare_outputs(res_output, case.expected_output)

            if is_correct:
                passed_count += 1
            else:
                if failed_stdout is None:
                    failed_stdout = res_output
                    failed_stderr = res_error
                    failed_compile = res_output if res_is_compile else ""
                    failed_time = res_time
                    failed_memory = res_mem
                    failed_exit_code = 124 if res_is_timeout else (1 if res_is_compile else 0)
                    failed_status = "Compilation Error" if res_is_compile else ("Time Limit Exceeded" if res_is_timeout else "Wrong Answer")

        if passed_count == total_count and results:
            primary_res = results[0]
            if isinstance(primary_res, Exception):
                stdout = ""
                stderr = str(primary_res)
                compile_output = ""
                execution_time = 0.0
                memory_used = 0.0
                exit_code = 1
                status_desc = "Error"
            else:
                stdout = primary_res.get("output") or ""
                stderr = primary_res.get("error") or ""
                
                res_comp = primary_res.get("compilationStatus")
                res_is_compile = res_comp is not None and str(res_comp) != "0"
                res_is_timeout = "timeout" in stdout.lower() or "timeout" in stderr.lower()
                
                compile_output = stdout if res_is_compile else ""
                
                try:
                    execution_time = float(primary_res.get("cpuTime") or 0.0)
                except ValueError:
                    execution_time = 0.0
                try:
                    memory_used = float(primary_res.get("memory") or 0.0)
                except ValueError:
                    memory_used = 0.0
                    
                exit_code = 124 if res_is_timeout else (1 if res_is_compile else 0)
                status_desc = "Compilation Error" if res_is_compile else ("Time Limit Exceeded" if res_is_timeout else "Accepted")
        else:
            stdout = failed_stdout or ""
            stderr = failed_stderr or ""
            compile_output = failed_compile or ""
            execution_time = failed_time
            memory_used = failed_memory
            exit_code = failed_exit_code
            status_desc = failed_status

        question_score = int(round((passed_count / total_count) * question_marks)) if total_count > 0 else 0

        from database import BgSessionLocal
        with BgSessionLocal() as write_db:
            submission = models.CodeSubmission(
                attempt_id=attempt_id,
                question_id=question_id,
                language=language,
                source_code=source_code,
                stdout=stdout,
                stderr=stderr,
                compile_output=compile_output,
                execution_time=execution_time,
                memory_used=memory_used,
                exit_code=exit_code,
                judge0_token="",  
                status=status_desc,
                passed_cases=passed_count,
                total_cases=total_count,
                score=question_score,
                is_draft=False,
                created_at=datetime.datetime.utcnow()
            )
            write_db.add(submission)
            write_db.commit()

        return {
            "score": question_score,
            "passed_cases": passed_count,
            "total_cases": total_count
        }

