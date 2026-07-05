import datetime
from typing import List
from collections import defaultdict
from pydantic import BaseModel, EmailStr
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from routers.auth import get_current_admin, get_current_user
from auth import get_password_hash, verify_password, create_access_token, create_refresh_token
from sqlalchemy import func

router = APIRouter(prefix="/institutes", tags=["Institutes"])
    
@router.get("", response_model=List[schemas.InstituteResponse])
def get_institutes(db: Session = Depends(get_db)):
    from services.cache import cache_service
    cached_res = cache_service.get("institutes_list")
    if cached_res:
        db.close()
        return cached_res
        
    res = db.query(models.Institute).filter(models.Institute.deleted_at == None).all()
    res_validated = [schemas.InstituteResponse.model_validate(inst) for inst in res]
    cache_service.set("institutes_list", res_validated)
    db.close()
    return res_validated

@router.post("", response_model=schemas.InstituteResponse)
def create_institute(inst_data: schemas.InstituteCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    existing = db.query(models.Institute).filter(models.Institute.code == inst_data.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Institute code already exists",
        )
    db_inst = models.Institute(
        name=inst_data.name,
        code=inst_data.code,
        description=inst_data.description,
        contact_person=inst_data.contact_person,
        contact_email=inst_data.contact_email,
        contact_number=inst_data.contact_number,
        deadline=inst_data.deadline
    )
    db.add(db_inst)
    db.commit()
    db.refresh(db_inst)
    
    from services.cache import cache_service
    cache_service.invalidate("institutes_list")
    
    db.close()
    return db_inst

@router.put("/{id}", response_model=schemas.InstituteResponse)
def update_institute(id: int, inst_data: schemas.InstituteCreate, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_inst = db.query(models.Institute).filter(models.Institute.id == id, models.Institute.deleted_at == None).first()
    if not db_inst:
        raise HTTPException(status_code=404, detail="Institute not found")
    
    if db_inst.code != inst_data.code:
        existing = db.query(models.Institute).filter(models.Institute.code == inst_data.code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Institute code already exists")

    db_inst.name = inst_data.name
    db_inst.code = inst_data.code
    db_inst.description = inst_data.description
    db_inst.contact_person = inst_data.contact_person
    db_inst.contact_email = inst_data.contact_email
    db_inst.contact_number = inst_data.contact_number
    db_inst.deadline = inst_data.deadline
    db.commit()
    db.refresh(db_inst)
    
    from services.cache import cache_service
    cache_service.invalidate("institutes_list")
    cache_service.invalidate(f"institute:{id}")
    
    db.close()
    return db_inst

@router.delete("/{id}")
def delete_institute(id: int, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    db_inst = db.query(models.Institute).filter(models.Institute.id == id, models.Institute.deleted_at == None).first()
    if not db_inst:
        raise HTTPException(status_code=404, detail="Institute not found")
    
    db_inst.deleted_at = datetime.datetime.utcnow()
    db.commit()
    
    from services.cache import cache_service
    cache_service.invalidate("institutes_list")
    cache_service.invalidate(f"institute:{id}")
    
    db.close()
    return {"detail": "Institute successfully deleted"}


@router.get("/{id}/students")
def get_institute_students(
    id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    institute = db.query(models.Institute).filter(
        models.Institute.id == id,
        models.Institute.deleted_at == None
    ).first()

    if not institute:
        raise HTTPException(
            status_code=404,
            detail="Institute not found"
        )

    students = (
        db.query(models.User)
        .filter(
            models.User.institute_id == id,
            models.User.role == "candidate"
        )
        .order_by(models.User.name.asc())
        .all()
    )

    student_ids = [student.id for student in students]
    assignments = (
        db.query(models.Assignment)
        .join(
            models.Assessment,
            models.Assessment.id == models.Assignment.assessment_id
        )
        .filter(
            models.Assignment.user_id.in_(student_ids)
        )
        .all()
    )
    assignment_map = defaultdict(list)
    for assignment in assignments:
        assignment_map[assignment.user_id].append({
            "assignment_id": assignment.id,
            "assessment_id": assignment.assessment.id,
            "assessment_name": assignment.assessment.name,
            "start_date": assignment.start_date,
            "end_date": assignment.end_date,
        })
    students_with_serial =[
        {
            "serial_no": index + 1,
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "status": student.status,
            "institute_id": student.institute_id,
        }
        for index, student in enumerate(students)
    ]
    return [
        {
            "serial_no": student["serial_no"],
            "id": student["id"],
            "student_id": student["email"].split("@")[0],   # temporary
            "name": student["name"],
            "email": student["email"],
            "status": student["status"],
            "assignments": assignment_map.get(student["id"], [])
        }
        for student in students_with_serial
    ]

@router.get("/{id}/bulk-summary/{assessment_id}")
def get_bulk_summary(
    id: int,
    assessment_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    institute = (
        db.query(models.Institute)
        .filter(
            models.Institute.id == id,
            models.Institute.deleted_at == None
            )
        .first()
    )
    if not institute:
        raise HTTPException(
            status_code=404,
            detail="Institute not found"
        )
    students = (
        db.query(models.User)
        .filter(
            models.User.institute_id == id,
            models.User.role == "candidate",
            models.User.status == "active"
        )
        .order_by(models.User.name.asc())
        .all()
    )
    total_students = len(students)
    assigned_user_ids = set(
        row[0]
        for row in db.query(models.Assignment.user_id)
        .filter(
            models.Assignment.institute_id == id,
            models.Assignment.assessment_id == assessment_id,
            models.Assignment.user_id.isnot(None)
        )
        .all()
    )
    already_assigned = len(assigned_user_ids)
    unassigned_students = [student for student in students if student.id not in assigned_user_ids]
    remaining_students = len(unassigned_students)
    
    preview_students = unassigned_students[:5]
    preview = [
        {
            "serial_no": students.index(student) + 1,
            "id": student.id,
            "name": student.name,
        }
        for student in preview_students
    ]
    if unassigned_students:

        first_serial = students.index(unassigned_students[0]) + 1

        last_serial = min(
            first_serial + 29,
            total_students
        )

    else:

        first_serial = 0
        last_serial = 0

    next_range = {
        "start": first_serial,
        "end": last_serial
    }
    return {
        "total_students": total_students,
        "already_assigned": already_assigned,
        "remaining_students": remaining_students,
        "next_range": next_range,
        "preview": preview,
    }
        
@router.post("/{id}/students")
def create_student(
    id: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    institute = db.query(models.Institute).filter(
        models.Institute.id == id,
        models.Institute.deleted_at == None
    ).first()

    if not institute:
        raise HTTPException(
            status_code=404,
            detail="Institute not found"
        )

    existing = db.query(models.User).filter(
        models.User.email == payload["email"]
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    student = models.User(
        name=payload["name"],
        email=payload["email"],
        password_hash=get_password_hash(payload["password"]),
        role="candidate",
        status="active",
        institute_id=id
    )

    db.add(student)
    db.commit()
    db.refresh(student)

    return {
        "message": "Student created successfully",
        "id": student.id
    }
    
@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    student = (
        db.query(models.User)
        .filter(
            models.User.id == student_id,
            models.User.role == "candidate"
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    db.delete(student)
    db.commit()

    return {
        "message": "Student deleted successfully"
    }



class UpdateStudentRequest(BaseModel):
    name: str
    email: EmailStr
    status: str
     
@router.put("/students/{student_id}")
def update_student(
    student_id: int,
    payload: UpdateStudentRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    print("admin:", admin)

    student = (
        db.query(models.User)
        
        .filter(
            models.User.id == student_id,
            models.User.role == "candidate"
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    existing = (
        db.query(models.User)
        .filter(
            models.User.email == payload.email,
            models.User.id != student_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    student.name = payload.name
    student.email = payload.email
    student.status = payload.status

    db.commit()
    db.refresh(student)

    return {
        "message": "Student updated successfully"
    }