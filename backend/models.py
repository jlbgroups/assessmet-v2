import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float, Index
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, default="candidate")  
    status = Column(String, default="active")  
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True, index=True)

    institute = relationship("Institute", back_populates="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    attempts = relationship("Attempt", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index("idx_refresh_tokens_user_revoked_expires", "user_id", "revoked", "expires_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)

    user = relationship("User", back_populates="refresh_tokens")


class Institute(Base):
    __tablename__ = "institutes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    contact_person = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_number = Column(String, nullable=True)
    deadline = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  

    users = relationship("User", back_populates="institute")
    assignments = relationship("Assignment", back_populates="institute", cascade="all, delete-orphan")


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    total_marks = Column(Integer, nullable=False)
    passing_marks = Column(Integer, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    active_version = Column(Integer, default=1)

    questions = relationship("Question", back_populates="assessment", cascade="all, delete-orphan")
    snapshots = relationship("AssessmentSnapshot", back_populates="assessment", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentSnapshot(Base):
    __tablename__ = "assessment_snapshots"
    __table_args__ = (
        Index("idx_assessment_snapshots_assessment_version", "assessment_id", "version"),
    )

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    snapshot_data = Column(JSON, nullable=False) 
    candidate_snapshot_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    assessment = relationship("Assessment", back_populates="snapshots")
    attempts = relationship("Attempt", back_populates="snapshot", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    type = Column(String, nullable=False)  
    difficulty = Column(String, default="medium")  
    marks = Column(Integer, default=1)
    options = Column(JSON, nullable=True)  
    correct_answer = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    
    allowed_languages = Column(JSON, nullable=True)
    boilerplate = Column(JSON, nullable=True)
    starter_code = Column(JSON, nullable=True)

    assessment = relationship("Assessment", back_populates="questions")
    test_cases = relationship("CodingTestCase", back_populates="question", cascade="all, delete-orphan")


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        Index("idx_assignments_assessment_user", "assessment_id", "user_id"),
        Index("idx_assignments_assessment_institute", "assessment_id", "institute_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False, index=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    role = Column(String, nullable=True)
    job_title = Column(String, nullable=True)

    assessment = relationship("Assessment", back_populates="assignments")
    node_institute = relationship("Institute", back_populates="assignments")
    institute = relationship("Institute", back_populates="assignments")


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = (
        Index("idx_attempts_user_status", "user_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assessment_snapshot_id = Column(Integer, ForeignKey("assessment_snapshots.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    score = Column(Integer, nullable=True)
    status = Column(String, default="active", index=True)  
    system_check_passed = Column(Boolean, default=False)
    feedback_rating = Column(Integer, nullable=True)
    feedback_comments = Column(Text, nullable=True)
    answers_data = Column(JSON, nullable=True)

    user = relationship("User", back_populates="attempts")
    snapshot = relationship("AssessmentSnapshot", back_populates="attempts")
    violations = relationship("Violation", back_populates="attempt", cascade="all, delete-orphan")
    session_tokens = relationship("ExamSessionToken", back_populates="attempt", cascade="all, delete-orphan")
    code_submissions = relationship("CodeSubmission", back_populates="attempt", cascade="all, delete-orphan")
    code_drafts = relationship("AttemptCodeDraft", back_populates="attempt", cascade="all, delete-orphan")
    telemetry = relationship("CodingTelemetry", back_populates="attempt", cascade="all, delete-orphan")


class ExamSessionToken(Base):
    __tablename__ = "exam_session_tokens"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=False)

    attempt = relationship("Attempt", back_populates="session_tokens")


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id"), nullable=False, index=True)
    type = Column(String, nullable=False) 
    severity = Column(String, default="medium")  
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    screenshot_path = Column(String, nullable=True, index=True)
    details = Column(Text, nullable=True)

    attempt = relationship("Attempt", back_populates="violations")


class CodingTestCase(Base):
    __tablename__ = "coding_test_cases"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    input_data = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    is_visible = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)

    question = relationship("Question", back_populates="test_cases")


class AttemptCodeDraft(Base):
    __tablename__ = "attempt_code_drafts"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String, nullable=False)
    source_code = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    attempt = relationship("Attempt", back_populates="code_drafts")


class CodeSubmission(Base):
    __tablename__ = "code_submissions"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String, nullable=False)
    source_code = Column(Text, nullable=False)
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    compile_output = Column(Text, nullable=True)
    execution_time = Column(Float, nullable=True)
    memory_used = Column(Float, nullable=True)
    exit_code = Column(Integer, nullable=True)
    judge0_token = Column(String, nullable=True)
    status = Column(String, nullable=True)
    passed_cases = Column(Integer, default=0)
    total_cases = Column(Integer, default=0)
    score = Column(Integer, default=0)
    is_draft = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    attempt = relationship("Attempt", back_populates="code_submissions")


class CodingTelemetry(Base):
    __tablename__ = "coding_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    run_count = Column(Integer, default=0)
    paste_count = Column(Integer, default=0)
    large_paste_count = Column(Integer, default=0)
    compile_errors = Column(Integer, default=0)

    attempt = relationship("Attempt", back_populates="telemetry")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    email = Column(String, index=True, nullable=True)
    action = Column(String, nullable=False, index=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

