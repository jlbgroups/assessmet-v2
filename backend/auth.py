import os
import secrets
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import models

SECRET_KEY = os.getenv("SECRET_KEY", "assesspro_ai_deep_indigo_mission_control_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_HOURS = 24
EXAM_SESSION_TOKEN_EXPIRE_HOURS = 4

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=REFRESH_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return payload
    except JWTError:
        return None

def add_refresh_token_record(db: Session, user_id: int) -> str:
    raw_token = secrets.token_urlsafe(32)
    db_token = models.RefreshToken(
        user_id=user_id,
        token=raw_token,
        expires_at=datetime.utcnow() + timedelta(hours=REFRESH_TOKEN_EXPIRE_HOURS),
        revoked=False
    )
    db.add(db_token)
    return raw_token

def generate_refresh_token_db(db: Session, user_id: int) -> str:
    raw_token = add_refresh_token_record(db, user_id)
    db.commit()
    return raw_token

def add_exam_session_token_record(db: Session, attempt_id: int, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> str:
    db.query(models.ExamSessionToken).filter(
        models.ExamSessionToken.attempt_id == attempt_id
    ).delete(synchronize_session=False)
    
    raw_token = f"exam_session_{secrets.token_urlsafe(32)}"
    db_token = models.ExamSessionToken(
        attempt_id=attempt_id,
        token=raw_token,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=datetime.utcnow() + timedelta(hours=EXAM_SESSION_TOKEN_EXPIRE_HOURS)
    )
    db.add(db_token)
    return raw_token

def generate_exam_session_token_db(db: Session, attempt_id: int, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> str:
    raw_token = add_exam_session_token_record(db, attempt_id, ip_address=ip_address, user_agent=user_agent)
    db.commit()
    return raw_token
