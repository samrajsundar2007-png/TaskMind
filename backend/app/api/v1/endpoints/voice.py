from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud import user as crud_user
from app.voice.stt import stt_service
from app.voice.tts import tts_service
from app.voice.voice_service import voice_service

router = APIRouter(prefix="/voice", tags=["Voice Interface"])


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to synthesize to speech")
    voice: Optional[str] = Field(None, description="Optional voice name (e.g. en-US-JennyNeural)")
    rate: Optional[str] = Field("+0%", description="Speech rate (e.g. +10%, -5%)")


class TranscribeResponse(BaseModel):
    transcript: str


class VoiceChatResponse(BaseModel):
    transcript: str
    reply: str
    spoken_text: str
    audio_base64: str
    tool_calls: List[Dict[str, Any]] = []
    requires_confirmation: bool = False
    session_id: str


@router.post("/transcribe", response_model=TranscribeResponse, status_code=status.HTTP_200_OK)
async def transcribe_audio(
    file: UploadFile = File(...),
):
    """
    Transcribe uploaded audio file to text using Whisper STT.
    Accepts webm, wav, mp3, ogg, m4a formats.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty.",
            )
        transcript = await stt_service.transcribe(
            audio_bytes=audio_bytes,
            filename=file.filename or "audio.webm",
            content_type=file.content_type or "audio/webm",
        )
        return TranscribeResponse(transcript=transcript)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}",
        )


@router.post("/synthesize", status_code=status.HTTP_200_OK)
async def synthesize_speech(
    payload: SynthesizeRequest,
):
    """
    Synthesize text to speech using Microsoft Edge Neural TTS.
    Returns direct audio/mpeg stream.
    """
    try:
        audio_bytes = await tts_service.synthesize(
            text=payload.text,
            voice=payload.voice,
            rate=payload.rate or "+0%",
        )
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech synthesis failed: {str(e)}",
        )


@router.post("/chat", response_model=VoiceChatResponse, status_code=status.HTTP_200_OK)
async def voice_chat(
    file: UploadFile = File(...),
    user_id: Optional[int] = Form(None),
    session_id: Optional[str] = Form(None),
    voice: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Complete end-to-end voice chat interaction:
    1. Transcribes incoming user speech via Whisper STT.
    2. Runs TaskMind agent to parse intent, schedule reminders & execute tool actions.
    3. Synthesizes a concise spoken reply via Edge TTS.
    4. Returns JSON containing transcript, text reply, base64 audio and tool execution audit.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )

    user = None
    if user_id:
        user = crud_user.get_user(db, user_id=user_id)
    if not user:
        user = crud_user.get_or_create_default_user(db)

    try:
        result = await voice_service.process_voice_message(
            audio_bytes=audio_bytes,
            db=db,
            user=user,
            session_id=session_id,
            filename=file.filename or "voice.webm",
            content_type=file.content_type or "audio/webm",
            voice=voice,
        )
        return VoiceChatResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice chat pipeline failed: {str(e)}",
        )


@router.get("/voices", status_code=status.HTTP_200_OK)
def get_available_voices():
    """
    List available neural voices with gender and locales.
    """
    return [
        {"id": "en-US-JennyNeural", "name": "Jenny (US English, Female)", "gender": "Female", "locale": "en-US"},
        {"id": "en-US-GuyNeural", "name": "Guy (US English, Male)", "gender": "Male", "locale": "en-US"},
        {"id": "en-US-AriaNeural", "name": "Aria (US English, Female)", "gender": "Female", "locale": "en-US"},
        {"id": "en-GB-SoniaNeural", "name": "Sonia (UK English, Female)", "gender": "Female", "locale": "en-GB"},
        {"id": "en-GB-RyanNeural", "name": "Ryan (UK English, Male)", "gender": "Male", "locale": "en-GB"},
        {"id": "en-IN-NeerjaNeural", "name": "Neerja (Indian English, Female)", "gender": "Female", "locale": "en-IN"},
        {"id": "en-IN-PrabhatNeural", "name": "Prabhat (Indian English, Male)", "gender": "Male", "locale": "en-IN"},
    ]
