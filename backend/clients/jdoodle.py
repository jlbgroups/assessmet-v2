import os
import asyncio
import httpx
from typing import List, Dict, Any, Optional

class JDoodleClient:
    LANGUAGE_MAP = {
        "python": ("python3", "4"),
        "javascript": ("nodejs", "4"),
        "cpp": ("cpp17", "0"),
        "java": ("java", "4")
    }

    def __init__(self):
        self.client_id = os.getenv("JDOODLE_CLIENT_ID", "")
        self.client_secret = os.getenv("JDOODLE_CLIENT_SECRET", "")
        self.base_url = "https://api.jdoodle.com/v1/execute"

    async def execute_code(self, script: str, language: str, stdin: str) -> Dict[str, Any]:

        if not self.client_id or not self.client_secret or "your_" in self.client_id:
            raise Exception("JDoodle credentials are not configured in backend/.env")

        lang_info = self.LANGUAGE_MAP.get(language.lower())
        if not lang_info:
            raise Exception(f"Language '{language}' is not supported by the current configurations.")

        jd_lang, version_index = lang_info

        payload = {
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
            "script": script,
            "language": jd_lang,
            "versionIndex": version_index,
            "stdin": stdin
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(self.base_url, json=payload)
            if response.status_code != 200:
                raise Exception(f"JDoodle execute request failed with HTTP {response.status_code}: {response.text}")
            return response.json()

    async def execute_batch(self, submissions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        
        if not submissions:
            return []

        tasks = [
            self.execute_code(
                script=sub["source_code"],
                language=sub["language"],
                stdin=sub.get("stdin") or ""
            )
            for sub in submissions
        ]

        return list(await asyncio.gather(*tasks, return_exceptions=True))
