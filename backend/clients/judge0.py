import os
import asyncio
import httpx
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

class Judge0Client:
    LANGUAGE_MAP = {
        "python": 71,
        "java": 62,
        "cpp": 54,
        "javascript": 63
    }

    def __init__(self):
        self.base_url = os.getenv("JUDGE0_URL", "http://localhost:2358").rstrip("/")
        self.api_key = os.getenv("JUDGE0_API_KEY", "")

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if not self.api_key:
            return headers

        if "rapidapi.com" in self.base_url:
            host = urlparse(self.base_url).netloc
            headers["X-RapidAPI-Key"] = self.api_key
            headers["X-RapidAPI-Host"] = host
        else:
            headers["X-Auth-Token"] = self.api_key
        return headers

    async def submit_batch(self, submissions: List[Dict[str, Any]]) -> List[str]:

        if not submissions:
            return []

        url = f"{self.base_url}/submissions/batch?base64_encoded=false"
        payload = {"submissions": submissions}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=self._get_headers())
            
            if response.status_code != 201:
                if response.status_code != 200:
                    raise Exception(f"Judge0 batch submission failed: {response.status_code} - {response.text}")

            result = response.json()
            tokens = [item["token"] for item in result if "token" in item]
            return tokens

    async def poll_batch(self, tokens: List[str], max_attempts: int = 15, delay: float = 0.5) -> List[Dict[str, Any]]:
        
        if not tokens:
            return []

        tokens_str = ",".join(tokens)
        url = f"{self.base_url}/submissions/batch?tokens={tokens_str}&base64_encoded=false"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            for attempt in range(max_attempts):
                response = await client.get(url, headers=self._get_headers())
                if response.status_code != 200:
                    raise Exception(f"Judge0 batch status poll failed: {response.status_code} - {response.text}")

                result = response.json()
                submissions = result.get("submissions", [])

                all_finished = True
                for sub in submissions:
                    status_id = sub.get("status", {}).get("id", 1)
                    if status_id in (1, 2):
                        all_finished = False
                        break

                if all_finished:
                    return submissions

                await asyncio.sleep(delay * (1.2 ** attempt))

            return submissions
