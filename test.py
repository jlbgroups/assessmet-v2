from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Update this according to your database
DATABASE_URL = "postgresql://postgres:rohit123@127.0.0.1:5433/assessment_local"

try:
    print("Connecting to PostgreSQL...\n")

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True
    )

    with engine.connect() as connection:
        print("✅ Database Connected Successfully!\n")

        version = connection.execute(
            text("SELECT version();")
        ).scalar()

        database = connection.execute(
            text("SELECT current_database();")
        ).scalar()

        user = connection.execute(
            text("SELECT current_user;")
        ).scalar()

        print(f"Database : {database}")
        print(f"User     : {user}")
        print(f"\nPostgreSQL Version:\n{version}")

except SQLAlchemyError as e:
    print("❌ Database Connection Failed!")
    print(e)

except Exception as e:
    print("❌ Unexpected Error!")
    print(e)