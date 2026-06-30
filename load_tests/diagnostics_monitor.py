import os
import sys
import time
import csv
import urllib.request
import json
from dotenv import load_dotenv
import psutil
from sqlalchemy import create_engine, text

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env")
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

engine = None
if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    except Exception as e:
        print(f"Warning: Failed to setup fallback DB engine: {e}")

CSV_FILE = "diagnostics.csv"

headers = [
    "Timestamp",
    "Elapsed_Seconds",
    "CPU_Percent",
    "Memory_Percent",
    "Pool_Checked_Out",
    "Pool_Checked_In",
    "Pool_Overflow",
    "Request_Rate_Per_Sec",
    "Cumulative_Requests",
    "Errors_Per_Sec",
    "Cumulative_Errors",
    "Postgres_Active_Conns",
    "Postgres_Idle_Conns",
    "Postgres_Idle_In_Tx_Conns",
    "Postgres_Waiting_Queries",
    "Postgres_Slowest_Query_Sec",
    "Postgres_Avg_Query_Sec",
    "Connection_Creation_Rate_Per_Sec",
    "API_Status"
]

with open(CSV_FILE, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(headers)

print(f"Diagnostics Monitor started. Writing real-time metrics to {CSV_FILE} every 1s...")
print("Press Ctrl+C to stop.")

start_time = time.time()
prev_requests = 0
prev_errors = 0
prev_creations = 0
prev_time = start_time

while True:
    current_time = time.time()
    elapsed = int(current_time - start_time)
    dt = current_time - prev_time
    prev_time = current_time
    
    cpu = psutil.cpu_percent()
    mem = psutil.virtual_memory().percent
    
    pool_out = "NaN"
    pool_in = "NaN"
    pool_overflow = "NaN"
    req_rate = 0.0
    cum_requests = "NaN"
    err_rate = 0.0
    cum_errors = "NaN"
    active_conns = "NaN"
    idle_conns = "NaN"
    idle_tx_conns = "NaN"
    waiting_queries = "NaN"
    slowest_query = "NaN"
    avg_query = "NaN"
    creation_rate = 0.0
    api_status = "Online"
    
    api_url = f"{API_BASE_URL.rstrip('/')}/api/diagnostics/stats"
    try:
        req = urllib.request.Request(api_url, headers={'User-Agent': 'Diagnostics-Monitor'})
        with urllib.request.urlopen(req, timeout=0.8) as response:
            data = json.loads(response.read().decode())
            
            cum_requests = data.get("request_count", 0)
            cum_errors = data.get("error_count", 0)
            cum_creations = data.get("connection_creations", 0)
            
            req_rate = max(0.0, (cum_requests - prev_requests) / dt) if prev_requests is not None else 0.0
            err_rate = max(0.0, (cum_errors - prev_errors) / dt) if prev_errors is not None else 0.0
            creation_rate = max(0.0, (cum_creations - prev_creations) / dt) if prev_creations is not None else 0.0
            
            prev_requests = cum_requests
            prev_errors = cum_errors
            prev_creations = cum_creations
            
            pool = data.get("pool", {})
            pool_out = pool.get("checked_out", "NaN")
            pool_in = pool.get("checked_in", "NaN")
            pool_overflow = pool.get("overflow", "NaN")
            
            pg = data.get("postgres", {})
            waiting_queries = pg.get("waiting_queries", "NaN")
            slowest_query = pg.get("slowest_query", "NaN")
            avg_query = pg.get("avg_query_time", "NaN")
            
            conns = pg.get("connections", {})
            active_conns = conns.get("active", "NaN")
            idle_conns = conns.get("idle", "NaN")
            idle_tx_conns = conns.get("idle_in_transaction", "NaN")
            
    except Exception as api_err:
        api_status = f"Offline/Timeout ({type(api_err).__name__})"
        if engine:
            try:
                with engine.connect() as conn:
                    active = conn.execute(text("""
                        SELECT state, COUNT(*)
                        FROM pg_stat_activity
                        GROUP BY state;
                    """)).fetchall()
                    
                    active_conns = 0
                    idle_conns = 0
                    idle_tx_conns = 0
                    for row in active:
                        state = row[0]
                        count = row[1]
                        if state == "active":
                            active_conns = count
                        elif state == "idle":
                            idle_conns = count
                        elif state == "idle in transaction":
                            idle_tx_conns = count

                    waiting_queries = conn.execute(text("""
                        SELECT COUNT(*)
                        FROM pg_stat_activity
                        WHERE wait_event IS NOT NULL;
                    """)).scalar() or 0

                    slowest_query = conn.execute(text("""
                        SELECT COALESCE(EXTRACT(EPOCH FROM (now() - query_start)), 0)
                        FROM pg_stat_activity
                        WHERE state <> 'idle'
                        ORDER BY 1 DESC
                        LIMIT 1;
                    """)).scalar() or 0.0

                    avg_query = conn.execute(text("""
                        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (now() - query_start))), 0)
                        FROM pg_stat_activity
                        WHERE state <> 'idle';
                    """)).scalar() or 0.0
            except Exception as db_err:
                api_status += f" + DB Error ({type(db_err).__name__})"
    
    row_data = [
        time.strftime('%Y-%m-%d %H:%M:%S'),
        elapsed,
        cpu,
        mem,
        pool_out,
        pool_in,
        pool_overflow,
        round(req_rate, 2),
        cum_requests,
        round(err_rate, 2),
        cum_errors,
        active_conns,
        idle_conns,
        idle_tx_conns,
        waiting_queries,
        round(slowest_query, 3) if isinstance(slowest_query, (int, float)) else slowest_query,
        round(avg_query, 3) if isinstance(avg_query, (int, float)) else avg_query,
        round(creation_rate, 2),
        api_status
    ]
    
    try:
        with open(CSV_FILE, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(row_data)
    except Exception as f_err:
        print(f"Error writing to file: {f_err}")

    print(f"[{elapsed:3d}s] CPU: {cpu:5.1f}% | Mem: {mem:5.1f}% | Pool Out: {pool_out} | Pool Overflow: {pool_overflow} | Req/s: {req_rate:5.1f} | Err/s: {err_rate:5.1f} | PG Active: {active_conns} | Slowest Q: {slowest_query}s | API: {api_status}")

    time.sleep(1.0)
