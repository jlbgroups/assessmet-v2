import sys
import os

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from backend.database import SessionLocal
from backend import models, auth

def create_and_assign_users(assessment_id=1, count=300):
    db = SessionLocal()
    try:
        print("[PREPARE] Hashing default password...")
        hashed_pwd = auth.get_password_hash("password123")
        
        print(f"[PREPARE] Creating {count} student accounts and assigning them to Assessment ID {assessment_id}...")
        
        for i in range(1, count + 1):
            pad = f"{i:03d}"
            email = f"k6_student_{pad}@example.com"
            name = f"K6 Student {pad}"
            
            user = db.query(models.User).filter(models.User.email == email).first()
            if not user:
                user = models.User(
                    email=email,
                    password_hash=hashed_pwd,
                    name=name,
                    role="candidate",
                    status="active"
                )
                db.add(user)
                db.flush()  
                print(f"Created student user: {email}")
            else:
                print(f"User {email} already exists.")
                
            assignment = db.query(models.Assignment).filter(
                models.Assignment.assessment_id == assessment_id,
                models.Assignment.user_id == user.id
            ).first()
            
            if not assignment:
                assignment = models.Assignment(
                    assessment_id=assessment_id,
                    user_id=user.id
                )
                db.add(assignment)
                db.flush()
                print(f"Assigned {email} to assessment {assessment_id}")
                
        db.commit()
        print(f"[PREPARE SUCCESS] All {count} student accounts created and assigned successfully!")
        
    except Exception as e:
        print(f"[PREPARE ERROR] Database operation failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    assessment_id = 1
    count = 300
    if len(sys.argv) > 1:
        try:
            assessment_id = int(sys.argv[1])
        except ValueError:
            print("Invalid assessment ID provided. Defaulting to 1.")
    if len(sys.argv) > 2:
        try:
            count = int(sys.argv[2])
        except ValueError:
            print("Invalid count provided. Defaulting to 300.")
            
    create_and_assign_users(assessment_id, count)
