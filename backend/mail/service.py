"""Business logic for managing mail domains, mailboxes, and aliases."""

from __future__ import annotations

from typing import Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .database import get_session
from .models import Alias, AliasDestination, Domain, Mailbox
from .utils import (
    hash_password,
    is_valid_email,
    normalize_local_part,
    validate_domain_name,
)
from .exceptions import MailServiceError
from backend.mail import cloudflare


# ---------- Serialization helpers ----------
def serialize_domain(domain: Domain) -> dict:
    return {
        "id": domain.id,
        "name": domain.name,
        "display_name": domain.display_name,
        "description": domain.description,
        "active": domain.active,
        "inbound_enabled": domain.inbound_enabled,
        "outbound_enabled": domain.outbound_enabled,
        "mx_hostname": domain.mx_hostname,
        "dkim_selector": domain.dkim_selector,
        "dkim_public_key": domain.dkim_public_key,
        "managed_by_cloudflare": domain.managed_by_cloudflare,
        "cloudflare_zone_id": domain.cloudflare_zone_id,
        "auto_dns_enabled": domain.auto_dns_enabled,
        "created_at": domain.created_at.isoformat() if domain.created_at else None,
        "updated_at": domain.updated_at.isoformat() if domain.updated_at else None,
        "mailbox_count": len(domain.mailboxes or []),
        "alias_count": len(domain.aliases or []),
    }


def serialize_mailbox(mailbox: Mailbox) -> dict:
    return {
        "id": mailbox.id,
        "domain_id": mailbox.domain_id,
        "email": f"{mailbox.local_part}@{mailbox.domain.name if mailbox.domain else ''}",
        "local_part": mailbox.local_part,
        "quota_mb": mailbox.quota_mb,
        "forwarding_enabled": mailbox.forwarding_enabled,
        "forwarding_address": mailbox.forwarding_address,
        "active": mailbox.active,
        "created_at": mailbox.created_at.isoformat() if mailbox.created_at else None,
        "updated_at": mailbox.updated_at.isoformat() if mailbox.updated_at else None,
    }


def serialize_alias(alias: Alias) -> dict:
    destinations = [
        {
            "id": dest.id,
            "destination": dest.destination,
            "destination_type": dest.destination_type,
            "priority": dest.priority,
            "created_at": dest.created_at.isoformat() if dest.created_at else None,
        }
        for dest in alias.destinations or []
    ]
    return {
        "id": alias.id,
        "domain_id": alias.domain_id,
        "email": f"{alias.local_part}@{alias.domain.name if alias.domain else ''}",
        "local_part": alias.local_part,
        "enabled": alias.enabled,
        "description": alias.description,
        "destinations": destinations,
        "created_at": alias.created_at.isoformat() if alias.created_at else None,
        "updated_at": alias.updated_at.isoformat() if alias.updated_at else None,
    }


# ---------- Domain operations ----------
def list_domains(active: Optional[bool] = None) -> List[dict]:
    with get_session() as session:
        stmt = select(Domain)
        if active is not None:
            stmt = stmt.where(Domain.active.is_(active))
        domains = session.scalars(stmt).all()
        # eager load relationships
        for d in domains:
            d.mailboxes  # noqa: B018
            d.aliases  # noqa: B018
        return [serialize_domain(domain) for domain in domains]


def get_domain(domain_id: int) -> dict:
    with get_session() as session:
        domain = session.get(Domain, domain_id)
        if not domain:
            raise MailServiceError("Domain not found")
        domain.mailboxes  # load
        domain.aliases  # load
        return serialize_domain(domain)


def create_domain(data: dict) -> dict:
    name = data.get("name", "").strip().lower()
    if not validate_domain_name(name):
        raise MailServiceError("Invalid domain name")

    domain = Domain(
        name=name,
        display_name=data.get("display_name", name),
        description=data.get("description"),
        active=bool(data.get("active", True)),
        inbound_enabled=bool(data.get("inbound_enabled", True)),
        outbound_enabled=bool(data.get("outbound_enabled", True)),
        mx_hostname=data.get("mx_hostname") or f"mail.{name}",
        managed_by_cloudflare=bool(data.get("managed_by_cloudflare", False)),
        cloudflare_zone_id=data.get("cloudflare_zone_id"),
        auto_dns_enabled=bool(data.get("auto_dns_enabled", False)),
    )
    with get_session() as session:
        session.add(domain)
        try:
            session.flush()
        except IntegrityError as exc:
            raise MailServiceError("Domain already exists") from exc
        session.refresh(domain)
        # Trigger Cloudflare DNS updates if needed
        if domain.auto_dns_enabled and domain.managed_by_cloudflare and domain.cloudflare_zone_id:
            try:
                cloudflare.ensure_domain_dns(domain)
            except Exception as exc:
                raise MailServiceError(f"Failed to update Cloudflare DNS: {exc}") from exc
        return serialize_domain(domain)


def update_domain(domain_id: int, data: dict) -> dict:
    with get_session() as session:
        domain = session.get(Domain, domain_id)
        if not domain:
            raise MailServiceError("Domain not found")
        for field in [
            "display_name",
            "description",
            "active",
            "inbound_enabled",
            "outbound_enabled",
            "mx_hostname",
            "dkim_selector",
            "dkim_private_key",
            "dkim_public_key",
            "managed_by_cloudflare",
            "cloudflare_zone_id",
            "auto_dns_enabled",
        ]:
            if field in data:
                setattr(domain, field, data[field])
        session.flush()
        session.refresh(domain)
        if domain.auto_dns_enabled and domain.managed_by_cloudflare and domain.cloudflare_zone_id:
            try:
                cloudflare.ensure_domain_dns(domain)
            except Exception as exc:
                raise MailServiceError(f"Failed to update Cloudflare DNS: {exc}") from exc
        return serialize_domain(domain)


def delete_domain(domain_id: int) -> None:
    with get_session() as session:
        domain = session.get(Domain, domain_id)
        if not domain:
            raise MailServiceError("Domain not found")
        session.delete(domain)


def get_domain_dns(domain_id: int) -> dict:
    with get_session() as session:
        domain = session.get(Domain, domain_id)
        if not domain:
            raise MailServiceError("Domain not found")
        mx_host = domain.mx_hostname or f"mail.{domain.name}"
        records = {
            "mx": [
                {
                    "type": "MX",
                    "name": domain.name,
                    "value": f"10 {mx_host}",
                    "ttl": 3600,
                }
            ],
            "spf": {
                "type": "TXT",
                "name": domain.name,
                "value": "v=spf1 mx ~all",
            },
            "dmarc": {
                "type": "TXT",
                "name": f"_dmarc.{domain.name}",
                "value": f"v=DMARC1; p=none; rua=mailto:postmaster@{domain.name}",
            },
        }
        if domain.dkim_selector and domain.dkim_public_key:
            records["dkim"] = {
                "type": "TXT",
                "name": f"{domain.dkim_selector}._domainkey.{domain.name}",
                "value": f"v=DKIM1; k=rsa; p={domain.dkim_public_key.strip()}",
            }
        return records


# ---------- Mailbox operations ----------
def list_mailboxes(domain_id: Optional[int] = None) -> List[dict]:
    with get_session() as session:
        stmt = select(Mailbox)
        if domain_id:
            stmt = stmt.where(Mailbox.domain_id == domain_id)
        mailboxes = session.scalars(stmt).all()
        for mailbox in mailboxes:
            mailbox.domain  # ensure relationship loaded
        return [serialize_mailbox(mb) for mb in mailboxes]


def get_mailbox(mailbox_id: int) -> dict:
    with get_session() as session:
        mailbox = session.get(Mailbox, mailbox_id)
        if not mailbox:
            raise MailServiceError("Mailbox not found")
        mailbox.domain  # load
        return serialize_mailbox(mailbox)


def create_mailbox(data: dict) -> dict:
    domain_id = data.get("domain_id")
    password = data.get("password", "").strip()
    local_part = normalize_local_part(data.get("local_part", ""))

    if not domain_id:
        raise MailServiceError("domain_id is required")
    if not local_part:
        raise MailServiceError("local_part is required")
    if not password:
        raise MailServiceError("password is required")

    with get_session() as session:
        domain = session.get(Domain, domain_id)
        if not domain:
            raise MailServiceError("Domain not found")
        mailbox = Mailbox(
            domain_id=domain_id,
            local_part=local_part,
            password_hash=hash_password(password),
            quota_mb=int(data.get("quota_mb", 1024)),
            forwarding_enabled=bool(data.get("forwarding_enabled", False)),
            forwarding_address=data.get("forwarding_address"),
            active=bool(data.get("active", True)),
        )
        session.add(mailbox)
        try:
            session.flush()
        except IntegrityError as exc:
            raise MailServiceError("Mailbox already exists") from exc
        session.refresh(mailbox)
        mailbox.domain = domain
        return serialize_mailbox(mailbox)


def update_mailbox(mailbox_id: int, data: dict) -> dict:
    with get_session() as session:
        mailbox = session.get(Mailbox, mailbox_id)
        if not mailbox:
            raise MailServiceError("Mailbox not found")
        if "local_part" in data:
            mailbox.local_part = normalize_local_part(data["local_part"])
        if "password" in data and data["password"]:
            mailbox.password_hash = hash_password(data["password"])
        for field in [
            "quota_mb",
            "forwarding_enabled",
            "forwarding_address",
            "active",
        ]:
            if field in data:
                setattr(mailbox, field, data[field])
        session.flush()
        session.refresh(mailbox)
        mailbox.domain  # load
        return serialize_mailbox(mailbox)


def delete_mailbox(mailbox_id: int) -> None:
    with get_session() as session:
        mailbox = session.get(Mailbox, mailbox_id)
        if not mailbox:
            raise MailServiceError("Mailbox not found")
        session.delete(mailbox)


# ---------- Alias operations ----------
def list_aliases(domain_id: Optional[int] = None) -> List[dict]:
    with get_session() as session:
        stmt = select(Alias)
        if domain_id:
            stmt = stmt.where(Alias.domain_id == domain_id)
        aliases = session.scalars(stmt).all()
        for alias in aliases:
            alias.domain  # load
            alias.destinations  # load
        return [serialize_alias(alias) for alias in aliases]


def get_alias(alias_id: int) -> dict:
    with get_session() as session:
        alias = session.get(Alias, alias_id)
        if not alias:
            raise MailServiceError("Alias not found")
        alias.domain  # load
        alias.destinations  # load
        return serialize_alias(alias)


def _apply_destinations(session, alias: Alias, destinations: Iterable) -> None:
    alias.destinations.clear()
    for entry in destinations or []:
        destination_email = None
        destination_type = "external"
        if isinstance(entry, str):
            destination_email = entry.strip()
        elif isinstance(entry, dict):
            if entry.get("mailbox_id"):
                mailbox = session.get(Mailbox, entry["mailbox_id"])
                if not mailbox:
                    raise MailServiceError(f"Mailbox {entry['mailbox_id']} not found")
                destination_email = f"{mailbox.local_part}@{mailbox.domain.name}"
                destination_type = "mailbox"
            else:
                destination_email = entry.get("email") or entry.get("destination")
                destination_type = entry.get("destination_type", "external")
        if not destination_email or not is_valid_email(destination_email):
            raise MailServiceError("Invalid destination email")
        alias.destinations.append(
            AliasDestination(
                destination=destination_email.lower(),
                destination_type=destination_type,
                priority=int(entry.get("priority", 10)) if isinstance(entry, dict) else 10,
            )
        )
    if not alias.destinations:
        raise MailServiceError("At least one destination is required")


def create_alias(data: dict) -> dict:
    domain_id = data.get("domain_id")
    local_part = normalize_local_part(data.get("local_part", ""))
    if not domain_id:
        raise MailServiceError("domain_id is required")
    if not local_part:
        raise MailServiceError("local_part is required")

    with get_session() as session:
        domain = session.get(Domain, domain_id)
        if not domain:
            raise MailServiceError("Domain not found")
        alias = Alias(
            domain_id=domain_id,
            local_part=local_part,
            description=data.get("description"),
            enabled=bool(data.get("enabled", True)),
        )
        session.add(alias)
        session.flush()
        _apply_destinations(session, alias, data.get("destinations"))
        session.flush()
        session.refresh(alias)
        alias.domain = domain
        return serialize_alias(alias)


def update_alias(alias_id: int, data: dict) -> dict:
    with get_session() as session:
        alias = session.get(Alias, alias_id)
        if not alias:
            raise MailServiceError("Alias not found")
        if "local_part" in data:
            alias.local_part = normalize_local_part(data["local_part"])
        if "enabled" in data:
            alias.enabled = bool(data["enabled"])
        if "description" in data:
            alias.description = data["description"]
        if "destinations" in data:
            _apply_destinations(session, alias, data.get("destinations"))
        session.flush()
        session.refresh(alias)
        alias.domain  # load
        alias.destinations  # load
        return serialize_alias(alias)


def delete_alias(alias_id: int) -> None:
    with get_session() as session:
        alias = session.get(Alias, alias_id)
        if not alias:
            raise MailServiceError("Alias not found")
        session.delete(alias)


