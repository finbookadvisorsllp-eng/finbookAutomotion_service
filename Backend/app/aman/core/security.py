"""Authentication primitives implemented with the Python standard library only.

We deliberately avoid third-party deps (python-jose / passlib) so the aman
package adds nothing to the shared ``requirements.txt``:

* JWT  -> HS256 = HMAC-SHA256 over base64url(header).base64url(payload)
* Hash -> PBKDF2-HMAC-SHA256 with a per-password random salt

This is a standard, production-acceptable construction for HS256 tokens.
"""
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from app.aman.config import aman_settings


# ─────────────────────────── base64url helpers ───────────────────────────
def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


# ─────────────────────────────── JWT (HS256) ───────────────────────────────
class TokenError(Exception):
    """Raised when a token is malformed, tampered, or expired."""


def _sign(message: bytes, secret: str) -> str:
    sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()
    return _b64url_encode(sig)


def create_token(claims: dict[str, Any], expires_minutes: int | None = None,
                 token_type: str = "access") -> str:
    header = {"alg": aman_settings.JWT_ALGORITHM, "typ": "JWT"}
    now = int(time.time())
    exp_minutes = expires_minutes if expires_minutes is not None else aman_settings.JWT_EXPIRE_MINUTES
    payload = {
        **claims,
        "iat": now,
        "exp": now + exp_minutes * 60,
        "type": token_type,
    }
    segments = [
        _b64url_encode(json.dumps(header, separators=(",", ":")).encode()),
        _b64url_encode(json.dumps(payload, separators=(",", ":")).encode()),
    ]
    signing_input = ".".join(segments).encode("ascii")
    segments.append(_sign(signing_input, aman_settings.JWT_SECRET))
    return ".".join(segments)


def create_access_token(claims: dict[str, Any]) -> str:
    return create_token(claims, aman_settings.JWT_EXPIRE_MINUTES, "access")


def create_refresh_token(claims: dict[str, Any]) -> str:
    return create_token(claims, aman_settings.JWT_REFRESH_EXPIRE_MINUTES, "refresh")


def decode_token(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError:
        raise TokenError("Malformed token")

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = _sign(signing_input, aman_settings.JWT_SECRET)
    if not hmac.compare_digest(expected_sig, sig_b64):
        raise TokenError("Invalid token signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError):
        raise TokenError("Invalid token payload")

    if int(payload.get("exp", 0)) < int(time.time()):
        raise TokenError("Token expired")

    return payload


# ─────────────────────────── password hashing ───────────────────────────
_PBKDF2_ROUNDS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${_b64url_encode(salt)}${_b64url_encode(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = _b64url_decode(salt_b64)
        expected = _b64url_decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(rounds))
        return hmac.compare_digest(dk, expected)
    except (ValueError, TypeError):
        return False
