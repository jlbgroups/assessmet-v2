from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Any, Dict
from datetime import datetime

SUPPORTED_LANGUAGES = {"python", "java", "cpp", "javascript"}

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    role: Optional[str] = "candidate"  
    institute_id: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    status: str
    institute_id: Optional[int] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    refresh_expires_in: int
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str

class TokenRefreshRequest(BaseModel):
    refresh_token: str


class AuthContext(BaseModel):
    id: int
    email: str
    role: str
    institute_id: Optional[int] = None


class InstituteCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_number: Optional[str] = None
    deadline: Optional[datetime] = None

class InstituteResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_number: Optional[str] = None
    deadline: Optional[datetime] = None

    class Config:
        from_attributes = True

class CodingTestCaseCreate(BaseModel):
    input_data: Optional[str] = ""
    expected_output: str
    is_visible: Optional[bool] = True
    order_index: Optional[int] = 0
class CodingTestCaseResponse(CodingTestCaseCreate):
    id: int
    question_id: Optional[int] = None

    class Config:
        from_attributes = True

class QuestionCreate(BaseModel):
    title: str
    type: str 
    difficulty: Optional[str] = "medium" 
    marks: Optional[int] = 1
    options: Optional[Any] = None 
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    
    allowed_languages: Optional[List[str]] = None
    boilerplate: Optional[Dict[str, str]] = None
    starter_code: Optional[Dict[str, str]] = None
    test_cases: Optional[List[CodingTestCaseCreate]] = None

    @field_validator("allowed_languages")
    @classmethod
    def validate_allowed_languages(cls, v):
        if v is not None:
            for lang in v:
                if lang not in SUPPORTED_LANGUAGES:
                    raise ValueError(f"Language {lang} is not supported. Supported: {SUPPORTED_LANGUAGES}")
        return v

    @field_validator("boilerplate", "starter_code")
    @classmethod
    def validate_code_templates(cls, v):
        if v is not None:
            if not isinstance(v, dict):
                raise ValueError("Boilerplate/Starter code must be a dictionary mapping languages to code strings.")
            for lang in v.keys():
                if lang not in SUPPORTED_LANGUAGES:
                    raise ValueError(f"Language key {lang} in code templates is not supported.")
        return v

class QuestionResponse(BaseModel):
    id: int
    assessment_id: Optional[int] = None
    title: str
    type: str
    difficulty: str
    marks: int
    options: Optional[Any] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    
    allowed_languages: Optional[List[str]] = None
    boilerplate: Optional[Dict[str, str]] = None
    starter_code: Optional[Dict[str, str]] = None
    test_cases: Optional[List[CodingTestCaseResponse]] = None

    class Config:
        from_attributes = True


class AssessmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int
    total_marks: int
    passing_marks: int
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    questions: List[QuestionCreate]

class AssessmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int
    total_marks: int
    passing_marks: int
    start_date: datetime
    end_date: datetime
    active_version: int
    user_attempt_status: Optional[str] = None
    user_attempt_score: Optional[int] = None
    user_attempt_id: Optional[int] = None

    class Config:
        from_attributes = True

class AssessmentDetailResponse(AssessmentResponse):
    questions: List[QuestionResponse]


class CandidateAssessmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int
    total_marks: int
    passing_marks: int
    start_date: datetime
    end_date: datetime
    active_version: int
    user_attempt_status: Optional[str] = None
    user_attempt_score: Optional[int] = None
    user_attempt_id: Optional[int] = None
    role: Optional[str] = None
    job_title: Optional[str] = None

    class Config:
        from_attributes = True


class FeedbackSubmit(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comments: Optional[str] = None


class AttemptStartRequest(BaseModel):
    assessment_id: int

class AttemptResponse(BaseModel):
    id: int
    user_id: int
    assessment_snapshot_id: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    score: Optional[int] = None
    status: str
    system_check_passed: bool

    class Config:
        from_attributes = True

class AttemptStartResponse(BaseModel):
    attempt: AttemptResponse
    exam_session_token: str
    snapshot_data: Dict[str, Any]  

class AttemptSubmitRequest(BaseModel):
    answers: Dict[str, Any]  


class ViolationCreate(BaseModel):
    type: str 
    severity: str  
    details: Optional[str] = None

class ViolationResponse(BaseModel):
    id: int
    attempt_id: int
    type: str
    severity: str
    timestamp: datetime
    screenshot_url: Optional[str] = None
    details: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_id: Optional[int] = None
    institute_name: Optional[str] = None
    assessment_name: Optional[str] = None

    class Config:
        from_attributes = True


class ActiveCandidateStatus(BaseModel):
    attempt_id: int
    candidate_name: str
    email: str
    assessment_name: str
    status: str  
    violation_count: int
    system_check_passed: bool
    last_active: datetime
    screenshot_url: Optional[str] = None


class CodeRunRequest(BaseModel):
    attempt_id: int
    question_id: int
    language: str
    source_code: str

    @field_validator("source_code")
    @classmethod
    def validate_source_code_size(cls, v):
        if len(v.encode('utf-8')) > 100 * 1024:
            raise ValueError("Source code size exceeds the 100 KB limit.")
        return v

    @field_validator("language")
    @classmethod
    def validate_lang(cls, v):
        if v not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Language {v} is not supported.")
        return v


class CodeRunResponse(BaseModel):
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    exit_code: Optional[int] = None
    status: Optional[str] = None
    passed: bool


class CodeSaveRequest(BaseModel):
    attempt_id: int
    question_id: int
    language: str
    source_code: str

    @field_validator("source_code")
    @classmethod
    def validate_source_code_size(cls, v):
        if len(v.encode('utf-8')) > 100 * 1024:
            raise ValueError("Source code size exceeds the 100 KB limit.")
        return v

    @field_validator("language")
    @classmethod
    def validate_lang(cls, v):
        if v not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Language {v} is not supported.")
        return v


class CodeDraftResponse(BaseModel):
    attempt_id: int
    question_id: int
    language: str
    source_code: str
    updated_at: datetime

    class Config:
        from_attributes = True


class CodeSubmissionResponse(BaseModel):
    id: int
    attempt_id: int
    question_id: int
    language: str
    source_code: str
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    exit_code: Optional[int] = None
    status: Optional[str] = None
    passed_cases: int
    total_cases: int
    score: int
    is_draft: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CodingTelemetryUpdateRequest(BaseModel):
    attempt_id: int
    question_id: int
    event_type: str 
    paste_length: Optional[int] = None
    
class BulkAutoAssignRequest(BaseModel):
    institute_id: int
    from_serial: int
    to_serial: int
    start_date: datetime
    end_date: datetime
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    role: Optional[str] = None
    job_title: Optional[str] = None
