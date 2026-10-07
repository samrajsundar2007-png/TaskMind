import logging
from typing import Optional, AsyncGenerator
import edge_tts
from app.config import settings

logger = logging.getLogger(__name__)


class TextToSpeechService:
    """Text-to-Speech service powered by Microsoft Edge Neural Voices."""

    def __init__(self, default_voice: Optional[str] = None):
        self.default_voice = default_voice or settings.VOICE_TTS_VOICE

    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ) -> bytes:
        """Synthesize text into MP3 audio bytes."""
        if not text or not text.strip():
            return b""

        selected_voice = voice or self.default_voice
        clean_text = text.strip()

        try:
            communicate = edge_tts.Communicate(
                text=clean_text,
                voice=selected_voice,
                rate=rate,
                pitch=pitch,
            )

            audio_chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_chunks.append(chunk["data"])

            audio_bytes = b"".join(audio_chunks)
            return audio_bytes
        except Exception as e:
            logger.error(f"Edge TTS synthesis error for text '{clean_text[:30]}...': {e}")
            raise e

    async def stream_audio(
        self,
        text: str,
        voice: Optional[str] = None,
    ) -> AsyncGenerator[bytes, None]:
        """Stream synthesized audio chunks for low-latency playback."""
        if not text or not text.strip():
            return

        selected_voice = voice or self.default_voice
        communicate = edge_tts.Communicate(text=text.strip(), voice=selected_voice)

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]


tts_service = TextToSpeechService()
