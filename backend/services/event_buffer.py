import asyncio
import logging
from typing import Dict, Optional, Tuple
from database import BgSessionLocal
import models

logger = logging.getLogger(__name__)

class EventBuffer:
    def __init__(self):
        self._telemetry_buffer: Dict[Tuple[int, int], Dict[str, int]] = {}
        self._lock = asyncio.Lock()

    async def add_telemetry(self, attempt_id: int, question_id: int, event_type: str, paste_length: int = 0):
        async with self._lock:
            key = (attempt_id, question_id)
            if key not in self._telemetry_buffer:
                self._telemetry_buffer[key] = {
                    "run_count": 0,
                    "paste_count": 0,
                    "large_paste_count": 0,
                    "compile_errors": 0
                }
            
            e_type = event_type.strip().lower()
            if e_type == "run":
                self._telemetry_buffer[key]["run_count"] += 1
            elif e_type == "paste":
                self._telemetry_buffer[key]["paste_count"] += 1
                if paste_length >= 50:
                    self._telemetry_buffer[key]["large_paste_count"] += 1
            elif e_type == "large_paste":
                self._telemetry_buffer[key]["large_paste_count"] += 1
            elif e_type == "compile_error":
                self._telemetry_buffer[key]["compile_errors"] += 1

    async def flush(self):
        async with self._lock:
            telemetry_to_flush = self._telemetry_buffer.copy()
            self._telemetry_buffer.clear()

        if not telemetry_to_flush:
            return

        with BgSessionLocal() as db:
            try:
                for (attempt_id, question_id), counts in telemetry_to_flush.items():
                    tel = db.query(models.CodingTelemetry).filter(
                        models.CodingTelemetry.attempt_id == attempt_id,
                        models.CodingTelemetry.question_id == question_id
                    ).first()
                    if not tel:
                        tel = models.CodingTelemetry(
                            attempt_id=attempt_id,
                            question_id=question_id,
                            run_count=0,
                            paste_count=0,
                            large_paste_count=0,
                            compile_errors=0
                        )
                        db.add(tel)
                    
                    tel.run_count += counts["run_count"]
                    tel.paste_count += counts["paste_count"]
                    tel.large_paste_count += counts["large_paste_count"]
                    tel.compile_errors += counts["compile_errors"]
                
                db.commit()
                logger.info(f"Successfully flushed {len(telemetry_to_flush)} telemetry updates to database.")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to flush telemetry events: {e}. Restoring to buffer for retry.")
                
                async with self._lock:
                    for (attempt_id, question_id), counts in telemetry_to_flush.items():
                        key = (attempt_id, question_id)
                        if key not in self._telemetry_buffer:
                            self._telemetry_buffer[key] = counts
                        else:
                            for k, v in counts.items():
                                self._telemetry_buffer[key][k] += v
                raise e

    async def start_loop(self):
        logger.info("Starting EventBuffer flush background loop.")
        delay = 5.0
        while True:
            await asyncio.sleep(delay)
            try:
                await self.flush()
                delay = 5.0  
            except Exception as e:
                logger.error(f"Error flushing telemetry events: {e}. Retrying in {delay * 2:.1f}s")
                delay = min(delay * 2, 60.0)  

event_buffer = EventBuffer()
