"""SQLAlchemy models for the mail management system."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class Domain(Base):
    """Managed domain with inbound/outbound settings."""

    __tablename__ = "mail_domains"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(255))
    description = Column(Text)
    active = Column(Boolean, default=True)
    inbound_enabled = Column(Boolean, default=True)
    outbound_enabled = Column(Boolean, default=True)
    mx_hostname = Column(String(255))
    dkim_selector = Column(String(64))
    dkim_private_key = Column(Text)
    dkim_public_key = Column(Text)
    managed_by_cloudflare = Column(Boolean, default=False)
    cloudflare_zone_id = Column(String(64))
    auto_dns_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    mailboxes = relationship(
        "Mailbox",
        back_populates="domain",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    aliases = relationship(
        "Alias",
        back_populates="domain",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Mailbox(Base):
    """Mailbox definition served by Dovecot."""

    __tablename__ = "mail_mailboxes"
    __table_args__ = (
        UniqueConstraint("domain_id", "local_part", name="uq_mailbox_domain_local"),
    )

    id = Column(Integer, primary_key=True)
    domain_id = Column(Integer, ForeignKey("mail_domains.id", ondelete="CASCADE"), nullable=False)
    local_part = Column(String(255), nullable=False)
    password_hash = Column(String(512), nullable=False)
    quota_mb = Column(Integer, default=1024)
    forwarding_enabled = Column(Boolean, default=False)
    forwarding_address = Column(String(255))
    active = Column(Boolean, default=True)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    domain = relationship("Domain", back_populates="mailboxes")


class Alias(Base):
    """Alias/forwarding rule managed by Postfix."""

    __tablename__ = "mail_aliases"
    __table_args__ = (
        UniqueConstraint("domain_id", "local_part", name="uq_alias_domain_local"),
    )

    id = Column(Integer, primary_key=True)
    domain_id = Column(Integer, ForeignKey("mail_domains.id", ondelete="CASCADE"), nullable=False)
    local_part = Column(String(255), nullable=False)
    description = Column(Text)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    domain = relationship("Domain", back_populates="aliases")
    destinations = relationship(
        "AliasDestination",
        back_populates="alias",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class AliasDestination(Base):
    """Destination for an alias (local mailbox or external address)."""

    __tablename__ = "mail_alias_destinations"

    id = Column(Integer, primary_key=True)
    alias_id = Column(Integer, ForeignKey("mail_aliases.id", ondelete="CASCADE"), nullable=False)
    destination = Column(String(255), nullable=False)
    destination_type = Column(String(32), default="external")  # external|mailbox
    priority = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)

    alias = relationship("Alias", back_populates="destinations")


