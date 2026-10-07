import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.voice.voice_service import clean_text_for_speech

client = TestClient(app)


def test_clean_text_for_speech():
    raw = "**Sure!** I've scheduled your task: *[Review Proposal](http://example.com)* for tomorrow at 3pm. Please make sure to bring your laptop. Let me know if you need anything else!"
    cleaned = clean_text_for_speech(raw, max_sentences=2)
    assert "**" not in cleaned
    assert "*" not in cleaned
    assert "[" not in cleaned
    assert "http" not in cleaned
    # Check that it truncated to at most 2 sentences
    assert "Sure! I've scheduled your task: Review Proposal for tomorrow at 3pm." in cleaned


def test_get_available_voices():
    response = client.get("/api/v1/voice/voices")
    assert response.status_code == 200
    voices = response.json()
    assert isinstance(voices, list)
    assert len(voices) > 0
    voice_ids = [v["id"] for v in voices]
    assert "en-US-JennyNeural" in voice_ids


def test_synthesize_endpoint():
    payload = {
        "text": "Hello, your task has been remembered.",
        "voice": "en-US-JennyNeural",
    }
    response = client.post("/api/v1/voice/synthesize", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 1000  # valid audio payload


def test_transcribe_endpoint():
    # Send mock audio file
    fake_audio = b"FAKE_AUDIO_DATA_FOR_WHISPER_TEST"
    files = {"file": ("test.webm", fake_audio, "audio/webm")}
    response = client.post("/api/v1/voice/transcribe", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "transcript" in data
    assert len(data["transcript"]) > 0


def test_voice_chat_endpoint():
    fake_audio = b"FAKE_AUDIO_DATA_FOR_VOICE_CHAT"
    files = {"file": ("voice_cmd.webm", fake_audio, "audio/webm")}
    data = {"session_id": "test_voice_session"}
    response = client.post("/api/v1/voice/chat", files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    assert "transcript" in res
    assert "reply" in res
    assert "spoken_text" in res
    assert "audio_base64" in res
    assert isinstance(res["tool_calls"], list)
