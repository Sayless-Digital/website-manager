"""Utility helpers for the mail subsystem."""

from __future__ import annotations

import hmac
import re
import secrets
from hashlib import pbkdf2_hmac
from typing import Tuple

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
DOMAIN_REGEX = re.compile(r"^(?=.{1,255}$)([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$")


def normalize_local_part(local_part: str) -> str:
    return local_part.strip().lower()


def validate_domain_name(domain: str) -> bool:
    return bool(DOMAIN_REGEX.match(domain.strip().lower()))


def is_valid_email(address: str) -> bool:
    return bool(EMAIL_REGEX.match(address.strip()))


def hash_password(password: str, salt: str | None = None) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256."""
    sanitized = password.strip()
    if not sanitized:
        raise ValueError("Password cannot be empty")
    if salt is None:
        salt = secrets.token_hex(16)
    dk = pbkdf2_hmac("sha256", sanitized.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, _hash = stored_hash.split("$", 1)
    except ValueError:
        return False
    new_hash = hash_password(password, salt)
    return hmac.compare_digest(new_hash, stored_hash)


def split_email_address(address: str) -> Tuple[str, str]:
    """Return (local_part, domain) for a given email address."""
    if not is_valid_email(address):
        raise ValueError("Invalid email address")
    local, domain = address.split("@", 1)
    return normalize_local_part(local), domain.lower()



