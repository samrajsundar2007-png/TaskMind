import base64
import logging
import re
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from app.config import settings
from app.crud import user as crud_user
from app.models.user import User
from app.agent.agent_loop import AgentLoop
from app.voice.stt import stt_service
from app.voice.tts import tts_service

logger = logging.getLogger(__name__)


def clean_text_for_speech(text: str, max_sentences: int = 2) -> str:
    """
    Format text for natural speech synthesis:
    1. Remove Markdown formatting (*, _, #, `, [text](url))
    2. Normalize whitespace
    3. Truncate to maximum sentence count (default 2) for concise voice interactions.
    """
    if not text:
        return ""

    # Remove markdown links [title](url) -> title
    cleaned = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove code blocks and backticks
    cleaned = re.sub(r'```[^`]*```', '', cleaned)
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)
    # Remove bold, italics, headers, bullets
    cleaned = re.sub(r'[*_#~>|]', '', cleaned)
    # Remove bullet markers like "- " or "• " at line starts
    cleaned = re.sub(r'(?m)^[-•\d+\.]\s*', '', cleaned)
    # Normalize multiple whitespace / newlines to single space
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Split into sentences
    sentence_endings = re.compile(r'(?<=[.!?])\s+')
    sentences = [s.strip() for s in sentence_endings.split(cleaned) if s.strip()]

    if len(sentences) > max_sentences:
        return " ".join(sentences[:max_sentences])
    return cleaned


class VoiceService:
    """High-level service orchestrating STT, Agent execution, and TTS."""

    def __init__(self):
        self.stt = stt_service
        self.tts = tts_service

    async def process_voice_message(
        self,
        audio_bytes: bytes,
        db: Session,
        user: Optional[User] = None,
        session_id: Optional[str] = None,
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
        voice: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        End-to-end voice loop:
        1. Transcribe audio -> transcript
        2. Run TaskMind Agent Loop -> reply + tool calls
        3. Clean reply for spoken output -> spoken_text (<= 2 sentences)
        4. Synthesize audio -> audio_base64
        """
        # 1. Transcribe Audio
        transcript = await self.stt.transcribe(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=content_type,
        )

        if not transcript or not transcript.strip():
            transcript = "No audible speech detected."
            reply = "I couldn't hear what you said. Please try speaking again."
            spoken = reply
            audio_data = await self.tts.synthesize(text=spoken, voice=voice)
            return {
                "transcript": transcript,
                "reply": reply,
                "spoken_text": spoken,
                "audio_base64": base64.b64encode(audio_data).decode("utf-8") if audio_data else "",
                "tool_calls": [],
                "requires_confirmation": False,
                "session_id": session_id or "voice_session",
            }

        # Ensure user exists
        if not user:
            user = crud_user.get_or_create_default_user(db)

        # 2. Run Agent
        effective_session = session_id or f"voice_{user.id}"
        agent = AgentLoop(db=db, user=user, session_id=effective_session)
        agent_response = agent.process_message(transcript)

        # 3. Clean Text for TTS (concise, <= 2 sentences)
        spoken_text = clean_text_for_speech(
            agent_response.reply,
            max_sentences=settings.VOICE_MAX_RESPONSE_SENTENCES,
        )

        # 4. Synthesize Spoken Audio with Edge TTS
        audio_mp3 = await self.tts.synthesize(text=spoken_text, voice=voice)
        audio_base64 = base64.b64encode(audio_mp3).decode("utf-8") if audio_mp3 else ""

        return {
            "transcript": transcript,
            "reply": agent_response.reply,
            "spoken_text": spoken_text,
            "audio_base64": audio_base64,
            "tool_calls": agent_response.tool_calls,
            "requires_confirmation": agent_response.requires_confirmation,
            "session_id": agent_response.session_id,
        }


voice_service = VoiceService()
