import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from database import SessionLocal
import models, auth

def seed_admin():
    db = SessionLocal()
    try:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@assesspro.ai")
        admin_password = os.getenv("ADMIN_PASSWORD", "password123")
        admin_name = os.getenv("ADMIN_NAME", "System Admin")

        existing_admin = db.query(models.User).filter(models.User.role == "admin").first()
        if existing_admin:
            print(f"Admin user already exists in the database: {existing_admin.email} (Name: {existing_admin.name})")
            return

        hashed_pwd = auth.get_password_hash(admin_password)
        db_admin = models.User(
            email=admin_email,
            password_hash=hashed_pwd,
            name=admin_name,
            role="admin",
            status="active"
        )
        db.add(db_admin)
        db.commit()
        print("Admin user seeded successfully!")
        print(f"Email: {admin_email}")
        print(f"Password: {admin_password}")
        print(f"Name: {admin_name}")
    except Exception as e:
        print(f"Error seeding admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
