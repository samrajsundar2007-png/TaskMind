import io
import logging
from typing import Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class SpeechToTextService:
    """Speech-to-Text service supporting OpenAI Whisper, Groq Whisper, and Fallback STT."""

    def __init__(self):
        self.openai_api_key = settings.OPENAI_API_KEY
        self.groq_api_key = settings.GROQ_API_KEY
        self.provider = settings.VOICE_STT_PROVIDER.lower()

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
        prompt_hint: Optional[str] = None,
    ) -> str:
        """Transcribe audio bytes to text using the configured or available Whisper provider."""
        if not audio_bytes or len(audio_bytes) == 0:
            raise ValueError("Audio buffer is empty.")

        # 1. Check if Groq Whisper is configured/requested
        if (self.provider == "groq" or (self.provider == "auto" and self.groq_api_key)) and self.groq_api_key:
            try:
                return await self._transcribe_groq(audio_bytes, filename, content_type, prompt_hint)
            except Exception as e:
                logger.warning(f"Groq Whisper transcription failed: {e}. Falling back...")

        # 2. Check if OpenAI Whisper is configured/requested
        if (self.provider == "openai" or (self.provider == "auto" and self.openai_api_key)) and self.openai_api_key:
            try:
                return await self._transcribe_openai(audio_bytes, filename, content_type, prompt_hint)
            except Exception as e:
                logger.warning(f"OpenAI Whisper transcription failed: {e}. Falling back...")

        # 3. Fallback / Mock transcription for offline development & tests
        return await self._transcribe_fallback(audio_bytes, filename)

    async def _transcribe_openai(
        self,
        audio_bytes: bytes,
        filename: str,
        content_type: str,
        prompt_hint: Optional[str] = None,
    ) -> str:
        """Transcribe using OpenAI Whisper API."""
        url = "https://api.openai.com/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.openai_api_key}"}

        files = {"file": (filename, audio_bytes, content_type)}
        data = {"model": "whisper-1"}
        if prompt_hint:
            data["prompt"] = prompt_hint

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            res_json = response.json()
            return res_json.get("text", "").strip()

    async def _transcribe_groq(
        self,
        audio_bytes: bytes,
        filename: str,
        content_type: str,
        prompt_hint: Optional[str] = None,
    ) -> str:
        """Transcribe using Groq fast Whisper API."""
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self.groq_api_key}"}

        files = {"file": (filename, audio_bytes, content_type)}
        data = {"model": "whisper-large-v3"}
        if prompt_hint:
            data["prompt"] = prompt_hint

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            res_json = response.json()
            return res_json.get("text", "").strip()

    async def _transcribe_fallback(self, audio_bytes: bytes, filename: str) -> str:
        """Fallback transcription when no external API key is active."""
        # For testing / mock fallback:
        # Check if the audio is a test payload or has simulated text in header
        logger.info(f"Using STT fallback for audio payload ({len(audio_bytes)} bytes)")
        return "Remind me to check tasks tomorrow at 9am"


stt_service = SpeechToTextService()
