import base64
import hashlib
import io
import json
import secrets
from typing import List, Optional, Tuple
import pyotp
import qrcode
from qrcode.image.pil import PilImage


def generate_totp_secret() -> str:
    """Generate a cryptographically secure 32-character Base32 TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, user_name: str, issuer: str = "TaskMind") -> str:
    """Generate the standard otpauth:// URI for Google Authenticator."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=user_name, issuer_name=issuer)


def generate_qr_code_base64(uri: str) -> str:
    """Render an otpauth:// URI to a base64 encoded PNG image."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_str}"


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """
    Verify a 6-digit TOTP code against the secret.
    Allows a 30-second clock-drift window (valid_window=1 allows ±30s).
    """
    if not secret or not code:
        return False
    # Strip any spaces or hyphens from user input
    sanitized_code = code.replace(" ", "").replace("-", "").strip()
    if not sanitized_code.isdigit() or len(sanitized_code) != 6:
        return False

    totp = pyotp.TOTP(secret)
    return totp.verify(sanitized_code, valid_window=valid_window)


def hash_backup_code(code: str) -> str:
    """Hash backup code for secure database storage."""
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()


def generate_backup_codes(count: int = 8) -> Tuple[List[str], str]:
    """
    Generate readable alphanumeric backup codes (e.g. 'a1b2-c3d4').
    Returns: (plain_codes_list, hashed_codes_json_str)
    """
    plain_codes = []
    hashed_codes = []

    for _ in range(count):
        part1 = secrets.token_hex(2)
        part2 = secrets.token_hex(2)
        code = f"{part1}-{part2}".upper()
        plain_codes.append(code)
        hashed_codes.append(hash_backup_code(code))

    return plain_codes, json.dumps(hashed_codes)


def verify_and_consume_backup_code(
    backup_codes_json: Optional[str],
    code: str,
) -> Tuple[bool, Optional[str]]:
    """
    Check if a code matches any stored hashed backup code and consumes it upon match.
    Returns: (is_valid, updated_backup_codes_json)
    """
    if not backup_codes_json:
        return False, None

    try:
        hashed_list = json.loads(backup_codes_json)
    except Exception:
        return False, None

    code_hash = hash_backup_code(code.upper())
    if code_hash in hashed_list:
        hashed_list.remove(code_hash)
        return True, json.dumps(hashed_list)

    return False, backup_codes_json
