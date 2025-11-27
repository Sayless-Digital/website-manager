"""Utilities for reading Maildir content (for testing mail client)."""

from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent

from .models import Mailbox
from .database import get_session
from backend.utils.commands import run_sudo_command

MAILDIR_ROOT = Path("/var/mail/vhosts")


def _get_maildir_path(mailbox: Mailbox) -> Path:
    domain = mailbox.domain
    if not domain:
        raise ValueError("Mailbox missing domain relationship")
    return MAILDIR_ROOT / domain.name / mailbox.local_part


def list_messages(mailbox_id: int, limit: int = 20):
    with get_session() as session:
        mailbox = session.get(Mailbox, mailbox_id)
        if not mailbox:
            raise ValueError("Mailbox not found")
        mailbox.domain  # load relationship
        path = _get_maildir_path(mailbox)

    script = dedent(
        f"""
        import json
        import mailbox
        import email.utils
        from pathlib import Path

        maildir_path = Path(r"{path / 'Maildir'}")
        messages = []
        if maildir_path.exists():
            md = mailbox.Maildir(str(maildir_path), create=False)
            items = list(md.items())
            for key, msg in items[-{limit}:][::-1]:
                date_tuple = email.utils.parsedate_tz(msg.get('date'))
                timestamp = email.utils.mktime_tz(date_tuple) if date_tuple else None
                messages.append({{
                    "id": key,
                    "subject": msg.get('subject'),
                    "from": msg.get('from'),
                    "to": msg.get('to'),
                    "date": timestamp,
                    "snippet": (msg.get_payload(decode=True) or b"").decode(errors='ignore')[:200]
                }})
        print(json.dumps(messages))
        """
    )
    result = run_sudo_command(f"python3 - <<'PY'\n{script}\nPY")
    if not result["success"]:
        raise RuntimeError(result["stderr"])
    return json.loads(result["stdout"] or "[]")


def get_message_body(mailbox_id: int, message_id: str):
    with get_session() as session:
        mailbox = session.get(Mailbox, mailbox_id)
        if not mailbox:
            raise ValueError("Mailbox not found")
        mailbox.domain  # load
        path = _get_maildir_path(mailbox)

    script = dedent(
        f"""
        import json
        import mailbox
        import email
        from pathlib import Path

        maildir_path = Path(r"{path / 'Maildir'}")
        result = {{}}
        if maildir_path.exists():
            md = mailbox.Maildir(str(maildir_path), create=False)
            if "{message_id}" in md:
                msg = md["{message_id}"]
                if msg.is_multipart():
                    parts = []
                    for part in msg.walk():
                        ctype = part.get_content_type()
                        if ctype in ('text/plain', 'text/html'):
                            payload = part.get_payload(decode=True) or b''
                            parts.append({{"type": ctype, "content": payload.decode(errors='ignore')}})
                    result = {{"subject": msg.get('subject'), "from": msg.get('from'), "to": msg.get('to'), "parts": parts}}
                else:
                    payload = msg.get_payload(decode=True) or b''
                    result = {{"subject": msg.get('subject'), "from": msg.get('from'), "to": msg.get('to'), "parts": [{{"type": msg.get_content_type(), "content": payload.decode(errors='ignore')}}]}}
        print(json.dumps(result))
        """
    )
    result = run_sudo_command(f"python3 - <<'PY'\n{script}\nPY")
    if not result["success"]:
        raise RuntimeError(result["stderr"])
    output = result["stdout"] or "{}"
    return json.loads(output)


