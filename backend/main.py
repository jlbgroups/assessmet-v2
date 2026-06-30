import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, institutes, assessments, proctoring, reports, code

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AssessPro AI API",
    description="Secure online assessment platform API with AI-proctoring features.",
    version="1.0"
)

origins = [
    "http://localhost:5173",  
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*",                      
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(institutes.router, prefix="/api")
app.include_router(assessments.router, prefix="/api")
app.include_router(assessments.attempts_router, prefix="/api")
app.include_router(code.router, prefix="/api")
app.include_router(proctoring.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "AssessPro AI API Service",
        "documentation": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}


import time
from fastapi import Request
from sqlalchemy import text
import database

REQUEST_COUNT = 0
ERROR_COUNT = 0

@app.middleware("http")
async def request_metrics_middleware(request: Request, call_next):
    if not database.DEBUG:
        return await call_next(request)

    count_token = database.request_query_count.set(0)
    time_token = database.request_sql_time.set(0.0)
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        return response
    finally:
        total_time = time.perf_counter() - start_time
        q_count = database.request_query_count.get()
        sql_time = database.request_sql_time.get()
        python_time = total_time - sql_time
        
        if not request.url.path.startswith("/api/diagnostics"):
            print(f"\n{request.method} {request.url.path}", flush=True)
            print(f"Queries: {q_count}", flush=True)
            print(f"SQL wait: {sql_time * 1000:.2f} ms", flush=True)
            print(f"Python: {python_time * 1000:.2f} ms", flush=True)
            print(f"Total: {total_time:.2f} s\n", flush=True)
            
        database.request_query_count.reset(count_token)
        database.request_sql_time.reset(time_token)


@app.middleware("http")
async def diagnostics_middleware(request: Request, call_next):
    global REQUEST_COUNT, ERROR_COUNT
    is_diag = request.url.path.startswith("/api/diagnostics")
    if not is_diag:
        REQUEST_COUNT += 1
    try:
        response = await call_next(request)
        if not is_diag and response.status_code >= 500:
            ERROR_COUNT += 1
        return response
    except Exception:
        if not is_diag:
            ERROR_COUNT += 1
        raise

@app.get("/api/diagnostics/stats")
def get_diagnostics_stats():
    db = database.SessionLocal()
    try:
        active_res = db.execute(text("""
            SELECT state, COUNT(*)
            FROM pg_stat_activity
            GROUP BY state;
        """)).fetchall()
        
        connections = {"active": 0, "idle": 0, "idle_in_transaction": 0, "other": 0}
        for state, count in active_res:
            if state == "active":
                connections["active"] = count
            elif state == "idle":
                connections["idle"] = count
            elif state == "idle in transaction":
                connections["idle_in_transaction"] = count
            elif state is not None:
                connections["other"] += count

        waiting_count = db.execute(text("""
            SELECT COUNT(*)
            FROM pg_stat_activity
            WHERE wait_event IS NOT NULL;
        """)).scalar() or 0

        slowest_runtime = db.execute(text("""
            SELECT COALESCE(EXTRACT(EPOCH FROM (now() - query_start)), 0)
            FROM pg_stat_activity
            WHERE state <> 'idle'
            ORDER BY 1 DESC
            LIMIT 1;
        """)).scalar() or 0.0

        avg_runtime = db.execute(text("""
            SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (now() - query_start))), 0)
            FROM pg_stat_activity
            WHERE state <> 'idle';
        """)).scalar() or 0.0
    except Exception as e:
        connections = {"error": str(e)}
        waiting_count = 0
        slowest_runtime = 0.0
        avg_runtime = 0.0
    finally:
        db.close()

    pool = database.engine.pool
    pool_stats = {
        "checked_out": pool.checkedout(),
        "checked_in": pool.size() - pool.checkedout(),
        "overflow": pool.overflow() if hasattr(pool, 'overflow') else 0,
        "size": pool.size() if hasattr(pool, 'size') else 0,
    }

    return {
        "request_count": REQUEST_COUNT,
        "error_count": ERROR_COUNT,
        "connection_creations": database.CONNECTION_CREATIONS,
        "pool": pool_stats,
        "postgres": {
            "connections": connections,
            "waiting_queries": waiting_count,
            "slowest_query": slowest_runtime,
            "avg_query_time": avg_runtime
        }
    }


from fastapi.responses import PlainTextResponse
from services.metrics import metrics_manager

@app.on_event("startup")
async def startup_event():
    import asyncio
    from services.event_buffer import event_buffer
    asyncio.create_task(event_buffer.start_loop())

@app.get("/metrics")
def get_metrics():
    from database import engine, bg_engine
    
    pool = engine.pool
    metrics_manager.set_gauge("db_pool_checked_out", pool.checkedout())
    metrics_manager.set_gauge("db_pool_overflow", pool.overflow() if hasattr(pool, 'overflow') else 0)
    metrics_manager.set_gauge("db_pool_size", pool.size() if hasattr(pool, 'size') else 0)
    
    bg_pool = bg_engine.pool
    metrics_manager.set_gauge("bg_db_pool_checked_out", bg_pool.checkedout())
    metrics_manager.set_gauge("bg_db_pool_overflow", bg_pool.overflow() if hasattr(bg_pool, 'overflow') else 0)
    metrics_manager.set_gauge("bg_db_pool_size", bg_pool.size() if hasattr(bg_pool, 'size') else 0)
    
    return PlainTextResponse(metrics_manager.get_prometheus_exposition())

