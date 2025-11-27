"""Mail management data layer."""

from .database import init_mail_db, get_session, MAIL_DB_PATH
from . import models  # Ensure models are registered
from . import service
from . import cloudflare

__all__ = ["init_mail_db", "get_session", "MAIL_DB_PATH", "models", "service", "cloudflare"]


