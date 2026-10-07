import uuid
import pytest
import pyotp
from fastapi.testclient import TestClient
from app.main import app
from app.auth import totp as totp_util

client = TestClient(app)


def test_totp_utilities():
    secret = totp_util.generate_totp_secret()
    assert len(secret) == 32

    uri = totp_util.get_totp_uri(secret, "TestUser", "TaskMind")
    assert "otpauth://totp/" in uri
    assert "TestUser" in uri
    assert secret in uri

    qr_base64 = totp_util.generate_qr_code_base64(uri)
    assert qr_base64.startswith("data:image/png;base64,")

    # Verify current code
    current_code = pyotp.TOTP(secret).now()
    assert totp_util.verify_totp_code(secret, current_code) is True
    assert totp_util.verify_totp_code(secret, "000000") is False

    # Backup codes
    plain_codes, hashed_json = totp_util.generate_backup_codes(count=4)
    assert len(plain_codes) == 4
    first_code = plain_codes[0]

    # Verify and consume backup code
    valid, updated_json = totp_util.verify_and_consume_backup_code(hashed_json, first_code)
    assert valid is True

    # Re-use should fail (single-use)
    valid_reused, _ = totp_util.verify_and_consume_backup_code(updated_json, first_code)
    assert valid_reused is False


def test_2fa_full_api_lifecycle():
    user_name = f"Alice2FA_{uuid.uuid4().hex[:8]}"
    login_res = client.post("/api/v1/auth/login", json={"name": user_name, "timezone": "UTC"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    user_id = login_res.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Setup 2FA
    setup_res = client.post("/api/v1/auth/2fa/setup", headers=headers)
    assert setup_res.status_code == 200
    setup_data = setup_res.json()
    secret = setup_data["secret"]
    assert "qr_code_base64" in setup_data

    # 2. Try enable with wrong code
    fail_enable = client.post(
        "/api/v1/auth/2fa/enable",
        json={"user_id": user_id, "code": "999999"},
        headers=headers,
    )
    assert fail_enable.status_code == 400

    # 3. Enable 2FA with valid TOTP code
    valid_code = pyotp.TOTP(secret).now()
    enable_res = client.post(
        "/api/v1/auth/2fa/enable",
        json={"user_id": user_id, "code": valid_code},
        headers=headers,
    )
    assert enable_res.status_code == 200
    enable_data = enable_res.json()
    assert enable_data["success"] is True
    backup_codes = enable_data["backup_codes"]
    assert len(backup_codes) == 8

    # 4. Now login should require 2FA
    login_2fa_req = client.post("/api/v1/auth/login", json={"name": user_name})
    assert login_2fa_req.status_code == 200
    assert login_2fa_req.json()["requires_2fa"] is True
    assert login_2fa_req.json()["access_token"] is None

    # 5. Verify 2FA login with valid code
    fresh_code = pyotp.TOTP(secret).now()
    verify_login_res = client.post(
        "/api/v1/auth/2fa/verify-login",
        json={"user_id": user_id, "code": fresh_code},
    )
    assert verify_login_res.status_code == 200
    assert verify_login_res.json()["access_token"] is not None

    # 6. Verify login with backup recovery code
    backup_login_res = client.post(
        "/api/v1/auth/2fa/verify-login",
        json={"user_id": user_id, "code": backup_codes[0]},
    )
    assert backup_login_res.status_code == 200

    # 7. Disable 2FA
    active_code = pyotp.TOTP(secret).now()
    disable_res = client.post(
        "/api/v1/auth/2fa/disable",
        json={"user_id": user_id, "code": active_code},
        headers=headers,
    )
    assert disable_res.status_code == 200
    assert disable_res.json()["success"] is True
