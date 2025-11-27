"""Cloudflare integration helpers for mail domain management."""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

import requests

from backend.mail.exceptions import MailServiceError
from backend.mail.models import Domain

from app import get_cloudflare_headers, log_cloudflare_email_event  # type: ignore

CF_API_BASE = "https://api.cloudflare.com/client/v4"
logger = logging.getLogger(__name__)


def _request(method: str, path: str, *, params=None, json=None):
    headers = get_cloudflare_headers()
    if not headers:
        raise MailServiceError("Cloudflare API not configured")
    url = f"{CF_API_BASE}{path}"
    response = requests.request(method, url, headers=headers, params=params, json=json, timeout=30)
    log_cloudflare_email_event('cloudflare_api', info=f"{method} {path}", status=response.status_code)
    if response.status_code >= 400:
        raise MailServiceError(response.text)
    data = response.json()
    if not data.get('success'):
        message = data.get('errors', [{}])[0].get('message', 'Cloudflare API error')
        raise MailServiceError(message)
    return data


def list_zones() -> List[Dict[str, str]]:
    data = _request('GET', '/zones')
    zones = []
    for zone in data.get('result', []):
        zones.append({
            'id': zone.get('id'),
            'name': zone.get('name'),
            'status': zone.get('status'),
        })
    return zones


def build_dns_records(domain: Domain) -> Dict[str, List[dict]]:
    mx_host = domain.mx_hostname or f"mail.{domain.name}"
    records = {
        'MX': [
            {'name': domain.name, 'content': mx_host, 'priority': 10},
        ],
        'TXT': [
            {'name': domain.name, 'content': "v=spf1 mx ~all"},
            {'name': f"_dmarc.{domain.name}", 'content': f"v=DMARC1; p=none; rua=mailto:postmaster@{domain.name}"},
        ],
    }
    if domain.dkim_selector and domain.dkim_public_key:
        records['TXT'].append({
            'name': f"{domain.dkim_selector}._domainkey.{domain.name}",
            'content': f"v=DKIM1; k=rsa; p={domain.dkim_public_key.strip()}",
        })
    return records


def ensure_dns_record(zone_id: str, record_type: str, name: str, content: str, priority: Optional[int] = None):
    existing = _request('GET', f'/zones/{zone_id}/dns_records', params={'type': record_type, 'name': name})
    record_data = {
        'type': record_type,
        'name': name,
        'content': content,
        'ttl': 3600,
        'proxied': False,
    }
    if priority is not None:
        record_data['priority'] = priority
    if existing.get('result'):
        record_id = existing['result'][0]['id']
        _request('PUT', f'/zones/{zone_id}/dns_records/{record_id}', json=record_data)
    else:
        _request('POST', f'/zones/{zone_id}/dns_records', json=record_data)


def ensure_domain_dns(domain: Domain):
    if not domain.cloudflare_zone_id:
        raise MailServiceError("Cloudflare zone ID missing for domain")
    records = build_dns_records(domain)
    for mx in records['MX']:
        ensure_dns_record(domain.cloudflare_zone_id, 'MX', mx['name'], mx['content'], mx.get('priority', 10))
    for txt in records['TXT']:
        ensure_dns_record(domain.cloudflare_zone_id, 'TXT', txt['name'], txt['content'])


