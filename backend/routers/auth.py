import time
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
import models, schemas, auth
from services.tasks import task_service
from services.metrics import metrics_manager

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> schemas.AuthContext:
    token = credentials.credentials
    payload = auth.verify_token(token, "access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid: subject missing",
        )
    user_id = payload.get("user_id")
    role = payload.get("role")
    if user_id is None or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid: user context missing",
        )
    return schemas.AuthContext(
        id=int(user_id),
        email=email,
        role=str(role),
        institute_id=payload.get("institute_id")
    )

def get_current_admin(current_user: schemas.AuthContext = Depends(get_current_user)) -> schemas.AuthContext:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user

@router.post("/register", response_model=schemas.UserResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    hashed_pwd = auth.get_password_hash(user_data.password)
    
    if user_data.institute_id:
        inst = db.query(models.Institute).filter(models.Institute.id == user_data.institute_id).first()
        if not inst:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Institute not found",
            )
        if inst.deadline and datetime.utcnow() > inst.deadline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The enrollment deadline for this institute has passed.",
            )
            
    db_user = models.User(
        email=user_data.email,
        password_hash=hashed_pwd,
        name=user_data.name,
        role="candidate",  
        institute_id=user_data.institute_id,
        status="active"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=schemas.TokenResponse)
def login(login_data: schemas.UserLogin, request: Request, background_tasks: BackgroundTasks):
    start = time.perf_counter()
    try:
        t_db_start = time.perf_counter()
        with SessionLocal() as db:
            user_row = db.execute(
                select(
                    models.User.id,
                    models.User.email,
                    models.User.password_hash,
                    models.User.name,
                    models.User.role,
                    models.User.status,
                    models.User.institute_id,
                ).where(models.User.email == login_data.email)
            ).mappings().first()
        t_db = time.perf_counter() - t_db_start
        metrics_manager.set_gauge("login_db", t_db)

        t_bcrypt_start = time.perf_counter()
        if not user_row or not auth.verify_password(login_data.password, user_row["password_hash"]):
            t_bcrypt = time.perf_counter() - t_bcrypt_start
            metrics_manager.set_gauge("login_bcrypt", t_bcrypt)
            
            client_ip = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            task_service.queue_login_audit(
                background_tasks,
                None,
                login_data.email,
                "login_failure",
                f"Failed login attempt: invalid credentials",
                client_ip,
                user_agent
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        t_bcrypt = time.perf_counter() - t_bcrypt_start
        metrics_manager.set_gauge("login_bcrypt", t_bcrypt)

        if user_row["status"] == "blocked":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is blocked",
            )

        t_refresh_start = time.perf_counter()
        access_token = auth.create_access_token(data={
            "sub": user_row["email"],
            "role": user_row["role"],
            "user_id": user_row["id"],
            "institute_id": user_row["institute_id"],
        })
        with SessionLocal() as db:
            refresh_token = auth.add_refresh_token_record(db, user_row["id"])
            db.commit()
        t_refresh = time.perf_counter() - t_refresh_start
        metrics_manager.set_gauge("login_refresh", t_refresh)

        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        task_service.queue_login_audit(
            background_tasks,
            user_row["id"],
            user_row["email"],
            "login_success",
            f"User logged in successfully",
            client_ip,
            user_agent
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in":auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "refresh_expires_in": auth.REFRESH_TOKEN_EXPIRE_HOURS * 60*60,
            "token_type": "bearer",
            "role": user_row["role"],
            "user_id": user_row["id"],
            "name": user_row["name"]
        }
    finally:
        t_total = time.perf_counter() - start
        metrics_manager.set_gauge("login_total", t_total)
        logger.info(
            "login took %.3f",
            t_total
        )

@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(refresh_data: schemas.TokenRefreshRequest, db: Session = Depends(get_db)):
    db_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == refresh_data.refresh_token,
        models.RefreshToken.revoked == False,
        models.RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired or revoked refresh token",
        )
        
    user = db.query(models.User).filter(models.User.id == db_token.user_id).first()
    if not user or user.status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User blocked or not found",
        )
        
    access_token = auth.create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "user_id": user.id,
        "institute_id": user.institute_id,
    })
    new_refresh_token = auth.add_refresh_token_record(db, user.id)
    db_token.revoked = True
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "expires_in": auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "refresh_expires_in": auth.REFRESH_TOKEN_EXPIRE_HOURS * 60 * 60,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "name": user.name
    }

@router.post("/logout")
def logout(refresh_data: schemas.TokenRefreshRequest, db: Session = Depends(get_db), current_user: schemas.AuthContext = Depends(get_current_user)):
    db_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == refresh_data.refresh_token,
        models.RefreshToken.user_id == current_user.id
    ).first()
    if db_token:
        db_token.revoked = True
        db.commit()
    return {"detail": "Logged out successfully"}

@router.post("/cleanup-tokens")
def cleanup_tokens(db: Session = Depends(get_db), current_user: schemas.AuthContext = Depends(get_current_admin)):
    expired_count = db.query(models.RefreshToken).filter(
        (models.RefreshToken.revoked == True) | (models.RefreshToken.expires_at < datetime.utcnow())
    ).delete(synchronize_session=False)
    db.commit()
    return {"detail": f"Successfully cleaned up {expired_count} stale refresh tokens."}
