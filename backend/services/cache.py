import time
from typing import Any, Dict, Optional, Tuple
import threading

class TTLCache:
    def __init__(self, default_ttl_seconds: int = 300, maxsize: int = 1000):
        self.default_ttl = default_ttl_seconds
        self.maxsize = maxsize
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                return None
            val, expiry = self._cache[key]
            if time.time() > expiry:
                del self._cache[key]
                return None
            return val

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        with self._lock:
            if len(self._cache) >= self.maxsize:
                now = time.time()
                expired_keys = [k for k, (_, exp) in self._cache.items() if now > exp]
                if expired_keys:
                    for k in expired_keys:
                        del self._cache[k]
                
                if len(self._cache) >= self.maxsize:
                    first_key = next(iter(self._cache))
                    del self._cache[first_key]
            
            ttl_val = ttl if ttl is not None else self.default_ttl
            self._cache[key] = (value, time.time() + ttl_val)

    def invalidate(self, key: str):
        with self._lock:
            if key in self._cache:
                del self._cache[key]

    def clear(self):
        with self._lock:
            self._cache.clear()

cache_service = TTLCache(default_ttl_seconds=300, maxsize=1000)
