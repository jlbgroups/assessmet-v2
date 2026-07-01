import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from routers.auth import get_current_admin, get_current_user

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
    
    from backend.services.cache import cache_service
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
    
    from backend.services.cache import cache_service
    cache_service.invalidate("institutes_list")
    cache_service.invalidate(f"institute:{id}")
    
    db.close()
    return {"detail": "Institute successfully deleted"}
