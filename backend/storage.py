import os
import uuid
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
VIOLATIONS_DIR = UPLOAD_DIR / "violations"

# Create directories if they don't exist
VIOLATIONS_DIR.mkdir(parents=True, exist_ok=True)

def get_base_url():
    return os.getenv("BASE_URL", "http://127.0.0.1:8000").rstrip("/")
BASE_URL=get_base_url()


def upload_screenshot(attempt_id: int, file_bytes: bytes) -> str:
    """
    Save screenshot locally.

    Returns:
        violations/xxxxxxxx.png
    """
    
    filename = f"attempt_{attempt_id}_{uuid.uuid4().hex}.jpg"
    
    filepath = VIOLATIONS_DIR / filename
    logger.info(f"Screenshot saved to {filepath}")
    try:
        
        with open(filepath, "wb") as f:
            f.write(file_bytes)
    except Exception as e:
        logger.error(f"Failed to save screenshot: {e}")
        raise Exception(f"Failed to save screenshot: {e}")
    
    return f"violations/{filename}"


def get_screenshot_url(path: str) -> str:
    """
    Generate public URL.
    """
    if not path:
        return ""
    return f"{BASE_URL}/uploads/{path}"


def get_screenshots_urls(paths: list[str]) -> dict[str, str]:

    result = {}

    for path in paths:
        if path:
            result[path] = get_screenshot_url(path)

    return result