"""Render Postfix and Dovecot configuration data based on DB contents."""

from __future__ import annotations

from pathlib import Path
from typing import Dict

from sqlalchemy import select

from .database import get_session
from .models import Alias, Mailbox

# Default mail storage root for Maildir accounts
MAILDIR_ROOT = Path("/var/mail/vhosts")


def _maildir_path(domain_name: str, local_part: str) -> Path:
    return MAILDIR_ROOT / domain_name / local_part


def generate_mail_configs() -> Dict[str, object]:
    """Return ready-to-write config strings and stats."""
    with get_session() as session:
        # Mailboxes
        mailbox_stmt = select(Mailbox).where(Mailbox.active.is_(True))
        mailboxes = session.scalars(mailbox_stmt).all()
        alias_stmt = select(Alias).where(Alias.enabled.is_(True))
        aliases = session.scalars(alias_stmt).all()

        alias_lines = []
        mailbox_lines = []
        dovecot_lines = []

        for mailbox in mailboxes:
            domain = mailbox.domain
            if not domain:
                continue
            email = f"{mailbox.local_part}@{domain.name}"
            maildir = _maildir_path(domain.name, mailbox.local_part)
            mailbox_lines.append(f"{email}\t{maildir}/")
            dovecot_lines.append(
                f"{email}:{mailbox.password_hash}:5000:5000::{maildir}::"
            )
            if mailbox.forwarding_enabled and mailbox.forwarding_address:
                alias_lines.append(f"{email}\t{mailbox.forwarding_address.strip().lower()}")

        for alias in aliases:
            domain = alias.domain
            if not domain:
                continue
            email = f"{alias.local_part}@{domain.name}"
            for destination in alias.destinations or []:
                alias_lines.append(f"{email}\t{destination.destination.strip().lower()}")

        alias_content = "\n".join(sorted(set(alias_lines))) + ("\n" if alias_lines else "")
        mailbox_content = "\n".join(sorted(set(mailbox_lines))) + ("\n" if mailbox_lines else "")
        dovecot_content = "\n".join(sorted(set(dovecot_lines))) + ("\n" if dovecot_lines else "")

        return {
            "alias_map": alias_content,
            "mailbox_map": mailbox_content,
            "dovecot_users": dovecot_content,
            "stats": {
                "mailboxes": len(mailboxes),
                "aliases": len(aliases),
                "destinations": sum(len(alias.destinations or []) for alias in aliases),
            },
        }



