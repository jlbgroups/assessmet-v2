import os
import time
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env")
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in environment or backend/.env file.")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

print(f"Database Connection Monitor started for database. Querying pg_stat_activity every 2s...")

while True:
    try:
        with engine.connect() as conn:
            print("=" * 80)
            print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            active = conn.execute(text("""
            SELECT state, COUNT(*)
            FROM pg_stat_activity
            GROUP BY state;
            """)).fetchall()

            print("\nConnections:")
            for row in active:
                print(f"  State: {row[0] or 'NULL'} | Count: {row[1]}")

            waiting = conn.execute(text("""
            SELECT wait_event_type,
                   wait_event,
                   COUNT(*)
            FROM pg_stat_activity
            WHERE wait_event IS NOT NULL
            GROUP BY wait_event_type, wait_event;
            """)).fetchall()

            print("\nWaiting Queries:")
            if waiting:
                for row in waiting:
                    print(f"  Type: {row[0]} | Event: {row[1]} | Count: {row[2]}")
            else:
                print("  None")

            slow = conn.execute(text("""
            SELECT
                pid,
                now()-query_start runtime,
                state,
                LEFT(query,80)
            FROM pg_stat_activity
            WHERE state <> 'idle'
            ORDER BY runtime DESC
            LIMIT 10;
            """)).fetchall()

            print("\nLongest Queries:")
            if slow:
                for row in slow:
                    print(f"  PID: {row[0]} | Runtime: {row[1]} | State: {row[2]} | Query: {row[3]}")
            else:
                print("  None")

            locks = conn.execute(text("""
            SELECT mode, locktype, granted, count(*)
            FROM pg_locks
            GROUP BY mode, locktype, granted
            ORDER BY count DESC;
            """)).fetchall()

            print("\nLocks:")
            if locks:
                for row in locks:
                    print(f"  Mode: {row[0]} | Type: {row[1]} | Granted: {row[2]} | Count: {row[3]}")
            else:
                print("  None")

            db_size = conn.execute(text("""
            SELECT pg_size_pretty(pg_database_size(current_database())) AS size;
            """)).scalar()
            print(f"\nDatabase Size: {db_size}")
            print("=" * 80)
            
    except Exception as e:
        print(f"Monitor error: {e}")
        
    time.sleep(2)
