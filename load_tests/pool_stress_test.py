import os
import sys
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env")
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in environment or backend/.env file.")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"Initializing create_engine against: {DATABASE_URL[:45]}...")
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

def worker(i):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.commit()
        if i % 100 == 0:
            print(f"Task {i} succeeded...")
    except Exception as e:
        print(f"Worker {i} failed: {e}")
        raise e
    return i

print("Running stress test with 100 concurrent threads executing 1000 database tasks...")
try:
    with ThreadPoolExecutor(max_workers=100) as ex:
        futures = [ex.submit(worker, i) for i in range(1000)]
        for f in futures:
            f.result()
    print("\nSUCCESS: Finished all 1000 tasks. The database is NOT the bottleneck.")
except Exception as e:
    print(f"\nFAILURE: The stress test failed. The database/connection limit IS the bottleneck.")
    sys.exit(1)
