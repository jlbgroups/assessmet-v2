import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is missing. "
        "Supabase PostgreSQL database connection is mandatory."
    )

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "30"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "60"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "15"))

BG_DB_POOL_SIZE = int(os.getenv("BG_DB_POOL_SIZE", "10"))
BG_DB_MAX_OVERFLOW = int(os.getenv("BG_DB_MAX_OVERFLOW", "20"))

engine = create_engine(
    DATABASE_URL,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    pool_recycle=1800,
)

bg_engine = create_engine(
    DATABASE_URL,
    pool_size=BG_DB_POOL_SIZE,
    max_overflow=BG_DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    pool_recycle=1800,
)

import logging
from sqlalchemy import event

logging.basicConfig(level=logging.INFO)
pool_logger = logging.getLogger("backend.database.pool")
pool_logger.setLevel(logging.INFO)

CONNECTION_CREATIONS = 0

if DEBUG:
    @event.listens_for(engine, "checkout")
    def checkout(dbapi_conn, conn_record, conn_proxy):
        pool_logger.info("CHECKOUT")

    @event.listens_for(engine, "checkin")
    def checkin(dbapi_conn, conn_record):
        pool_logger.info("CHECKIN")

    @event.listens_for(engine, "connect")
    def connect(dbapi_conn, conn_record):
        global CONNECTION_CREATIONS
        CONNECTION_CREATIONS += 1
        pool_logger.info("NEW CONNECTION")


import time
import contextvars

request_query_count = contextvars.ContextVar("request_query_count", default=0)
request_sql_time = contextvars.ContextVar("request_sql_time", default=0.0)

query_logger = logging.getLogger("sql")
query_logger.setLevel(logging.WARNING)

if DEBUG:
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if context:
            context._query_start = time.perf_counter()

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if context and hasattr(context, "_query_start"):
            duration = time.perf_counter() - context._query_start
            try:
                request_query_count.set(request_query_count.get() + 1)
                request_sql_time.set(request_sql_time.get() + duration)
            except Exception:
                pass
                
            elapsed = duration * 1000
            if elapsed > 50:          
                query_logger.warning(
                    "%.2f ms | %s",
                    elapsed,
                    statement.split("\n")[0][:120]
                )

    @event.listens_for(Session, "after_begin")
    def tx_begin(session, transaction, connection):
        pool_logger.info("TX BEGIN %s", id(session))

    @event.listens_for(Session, "after_commit")
    def tx_commit(session):
        pool_logger.info("TX COMMIT %s", id(session))

    @event.listens_for(Session, "after_rollback")
    def tx_rollback(session):
        pool_logger.info("TX ROLLBACK %s", id(session))



PERFORMANCE_INDEX_STATEMENTS = (
    "CREATE INDEX IF NOT EXISTS idx_assignments_assessment_user ON assignments (assessment_id, user_id);",
    "CREATE INDEX IF NOT EXISTS idx_assignments_assessment_institute ON assignments (assessment_id, institute_id);",
    "CREATE INDEX IF NOT EXISTS idx_questions_assessment_id ON questions (assessment_id);",
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked_expires ON refresh_tokens (user_id, revoked, expires_at);",
    "CREATE INDEX IF NOT EXISTS idx_assessment_snapshots_assessment_version ON assessment_snapshots (assessment_id, version);",
    "CREATE INDEX IF NOT EXISTS idx_attempts_user_status ON attempts (user_id, status);",
    "CREATE INDEX IF NOT EXISTS idx_exam_session_tokens_attempt_id ON exam_session_tokens (attempt_id);",
)

def run_core_migrations(conn):
    try:
        conn.execute(text("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;"))
        conn.execute(text("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;"))
        conn.execute(text("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS role VARCHAR;"))
        conn.execute(text("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS job_title VARCHAR;"))
        conn.execute(text("ALTER TABLE attempts ADD COLUMN IF NOT EXISTS feedback_rating INTEGER;"))
        conn.execute(text("ALTER TABLE attempts ADD COLUMN IF NOT EXISTS feedback_comments TEXT;"))
        conn.execute(text("ALTER TABLE attempts ADD COLUMN IF NOT EXISTS answers_data JSON;"))
        conn.execute(text("ALTER TABLE assessment_snapshots ADD COLUMN IF NOT EXISTS candidate_snapshot_data JSON;"))
        
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_violations_attempt_id ON violations (attempt_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations (timestamp);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_violations_screenshot_path ON violations (screenshot_path);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts (status);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts (user_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_institute_id ON users (institute_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_assessment_snapshots_assessment_id ON assessment_snapshots (assessment_id);"))
        for statement in PERFORMANCE_INDEX_STATEMENTS:
            conn.execute(text(statement))
        
        conn.commit()
    except Exception as e:
        print("Core migration warning:", e)

def run_coding_migrations(conn):
    try:
        conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS allowed_languages JSON;"))
        conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS boilerplate JSON;"))
        conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS starter_code JSON;"))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS coding_test_cases (
                id SERIAL PRIMARY KEY,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
                input_data TEXT NOT NULL,
                expected_output TEXT NOT NULL,
                is_visible BOOLEAN DEFAULT TRUE,
                order_index INTEGER DEFAULT 0
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS attempt_code_drafts (
                id SERIAL PRIMARY KEY,
                attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE NOT NULL,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
                language VARCHAR NOT NULL,
                source_code TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_attempt_question_lang UNIQUE (attempt_id, question_id, language)
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS code_submissions (
                id SERIAL PRIMARY KEY,
                attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE NOT NULL,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
                language VARCHAR NOT NULL,
                source_code TEXT NOT NULL,
                stdout TEXT,
                stderr TEXT,
                compile_output TEXT,
                execution_time FLOAT,
                memory_used FLOAT,
                exit_code INTEGER,
                judge0_token VARCHAR,
                status VARCHAR,
                passed_cases INTEGER DEFAULT 0,
                total_cases INTEGER DEFAULT 0,
                score INTEGER DEFAULT 0,
                is_draft BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS coding_telemetry (
                id SERIAL PRIMARY KEY,
                attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE NOT NULL,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
                run_count INTEGER DEFAULT 0,
                paste_count INTEGER DEFAULT 0,
                large_paste_count INTEGER DEFAULT 0,
                compile_errors INTEGER DEFAULT 0,
                CONSTRAINT uq_attempt_question_telemetry UNIQUE (attempt_id, question_id)
            );
        """))

        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_coding_test_cases_question_id ON coding_test_cases (question_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_attempt_code_drafts_attempt_question ON attempt_code_drafts (attempt_id, question_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_code_submissions_attempt_id ON code_submissions (attempt_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_coding_telemetry_attempt_id ON coding_telemetry (attempt_id);"))

        conn.commit()
    except Exception as e:
        print("Coding migration warning:", e)

with engine.connect() as conn:
    run_core_migrations(conn)
    run_coding_migrations(conn)

class TimedSession(Session):
    def __init__(self, *args, **kwargs):
        self.start = time.time()
        super().__init__(*args, **kwargs)

    def commit(self):
        before = time.perf_counter()
        res = super().commit()
        commit_dur = time.perf_counter() - before
        pool_logger.info("commit %.3f", commit_dur)
        print(f"Commit after {time.time()-self.start:.3f}s", flush=True)
        return res

    def close(self):
        res = super().close()
        print(f"Close after {time.time()-self.start:.3f}s", flush=True)
        return res

SessionLocal = sessionmaker(class_=TimedSession if DEBUG else Session, autocommit=False, autoflush=False, bind=engine)
BgSessionLocal = sessionmaker(class_=TimedSession if DEBUG else Session, autocommit=False, autoflush=False, bind=bg_engine)

Base = declarative_base()

def get_db():
    from services.metrics import metrics_manager
    import time
    start = time.perf_counter()
    db = SessionLocal()
    try:
        if DEBUG:
            db.connection()
            checkout_time = time.perf_counter() - start
            metrics_manager.set_gauge("db_connection_checkout_seconds", checkout_time)
            print(f"Connection checkout: {checkout_time:.3f}s", flush=True)
        yield db
    finally:
        if DEBUG:
            held = time.perf_counter() - start
            metrics_manager.set_gauge("db_session_held_seconds", held)
            print(f"Session held for {held:.2f}s", flush=True)
        db.close()
