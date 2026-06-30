import os
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "violations")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_KEY environment variables are missing. "
        "Supabase storage integration is mandatory."
    )

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    raise RuntimeError(f"Failed to initialize Supabase storage client: {e}")


def upload_screenshot(attempt_id: int, file_bytes: bytes) -> str:
    file_ext = ".jpg"
    unique_filename = f"attempt_{attempt_id}_{uuid.uuid4()}{file_ext}"
    path_on_bucket = f"violations/{unique_filename}"

    try:
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=path_on_bucket,
            file=file_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        return path_on_bucket
    except Exception as e:
        print(f"Supabase upload failed: {e}")
        raise RuntimeError(f"Supabase upload failed: {e}")


def get_screenshot_signed_url(screenshot_path: str) -> str:
    if not screenshot_path:
        return ""

    try:
        response = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(
            path=screenshot_path,
            expires_in=900
        )
        if isinstance(response, dict) and "signedURL" in response:
            return response["signedURL"]
        elif hasattr(response, "get"):
            return response.get("signedURL", "")
        return str(response)
    except Exception as e:
        print(f"Failed to generate signed URL from Supabase: {e}")
        return ""


def get_screenshots_signed_urls(screenshot_paths: list) -> dict:
    if not screenshot_paths:
        return {}
    
    valid_paths = [p for p in screenshot_paths if p]
    if not valid_paths:
        return {}

    try:
        unique_paths = list(set(valid_paths))
        response = supabase.storage.from_(SUPABASE_BUCKET).create_signed_urls(
            paths=unique_paths,
            expires_in=900
        )
        urls_map = {}
        if isinstance(response, list):
            for item in response:
                path = item.get("path")
                url = item.get("signedURL") or item.get("signedUrl")
                if path and url:
                    urls_map[path] = url
        return urls_map
    except Exception as e:
        print(f"Failed to generate batch signed URLs from Supabase: {e}")
        return {}

