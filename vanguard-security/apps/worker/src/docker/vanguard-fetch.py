#!/usr/bin/env python3
"""
OPSEC HTTP module using curl_cffi for Chrome JA3/JA4 TLS fingerprint impersonation.

Reads a JSON request descriptor from argv[1] and writes a FetchDigest JSON to stdout.
"""

import hashlib
import json
import random
import re
import sys
import time
import unicodedata
from dataclasses import asdict, dataclass
from typing import Optional
from urllib.parse import urlparse, urlunparse

try:
    from curl_cffi import requests as cffi_requests
    CURL_CFFI_AVAILABLE = True
except ImportError:
    import urllib.request
    CURL_CFFI_AVAILABLE = False

BODY_MAX_BYTES = 8192

# Impersonation bundles keyed by profile name.
# curl_cffi impersonates browser TLS ClientHello + HTTP/2 fingerprint.
UA_BUNDLES: dict[str, dict] = {
    'chrome120': {
        'impersonate': 'chrome120',
        'user_agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ),
    },
    'chrome110': {
        'impersonate': 'chrome110',
        'user_agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
        ),
    },
    'firefox117': {
        'impersonate': 'firefox117',
        'user_agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:117.0) '
            'Gecko/20100101 Firefox/117.0'
        ),
    },
    'safari17': {
        'impersonate': 'safari17_0',
        'user_agent': (
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 '
            '(KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        ),
    },
}

HEADER_BLOCKLIST = frozenset(['set-cookie', 'authorization'])


@dataclass
class FetchDigest:
    url: str
    status_code: int
    headers_safe: dict
    body_snippet: str
    body_hash: str
    body_truncated: bool
    elapsed_ms: float
    impersonate_profile: str
    error: Optional[str]


def _safe_headers(raw_headers: dict) -> dict:
    return {
        k: v
        for k, v in raw_headers.items()
        if k.lower() not in HEADER_BLOCKLIST
    }


def _rewrite_fireprox(url: str, fireprox_base: Optional[str]) -> str:
    if not fireprox_base:
        return url
    parsed = urlparse(url)
    fp_parsed = urlparse(fireprox_base.rstrip('/'))
    # Replace scheme+netloc with FireProx gateway, keep path+query
    rewritten = urlunparse((
        fp_parsed.scheme,
        fp_parsed.netloc,
        fp_parsed.path.rstrip('/') + parsed.path,
        parsed.params,
        parsed.query,
        parsed.fragment,
    ))
    return rewritten


def vanguard_fetch(
    url: str,
    method: str = 'GET',
    headers: Optional[dict] = None,
    body: Optional[str] = None,
    config: Optional[dict] = None,
) -> FetchDigest:
    config = config or {}
    profile_name = config.get('impersonate_profile', 'chrome120')
    fireprox_base = config.get('fireprox_base')
    rate_limit_rps = config.get('rate_limit_rps', 0)
    timeout = config.get('timeout_s', 15)

    bundle = UA_BUNDLES.get(profile_name, UA_BUNDLES['chrome120'])

    # Rate-limit jitter: sleep 1/rps ± 20% when rps > 0
    if rate_limit_rps > 0:
        base_sleep = 1.0 / rate_limit_rps
        jitter = base_sleep * 0.2 * (random.random() * 2 - 1)
        time.sleep(max(0.0, base_sleep + jitter))

    effective_url = _rewrite_fireprox(url, fireprox_base)

    req_headers = {'User-Agent': bundle['user_agent']}
    if headers:
        req_headers.update(headers)

    body_bytes = body.encode('utf-8') if body else None

    start = time.monotonic()
    try:
        if CURL_CFFI_AVAILABLE:
            resp = cffi_requests.request(
                method=method.upper(),
                url=effective_url,
                headers=req_headers,
                content=body_bytes,
                impersonate=bundle['impersonate'],
                timeout=timeout,
            )
            status_code = resp.status_code
            resp_headers = dict(resp.headers)
            resp_body = resp.content
        else:
            req = urllib.request.Request(effective_url, data=body_bytes, headers=req_headers, method=method.upper())
            with urllib.request.urlopen(req, timeout=timeout) as r:
                status_code = r.status
                resp_headers = dict(r.headers)
                resp_body = r.read()

        elapsed_ms = (time.monotonic() - start) * 1000

        truncated = len(resp_body) > BODY_MAX_BYTES
        body_chunk = resp_body[:BODY_MAX_BYTES]
        body_hash = hashlib.sha256(resp_body).hexdigest()

        # Decode snippet best-effort
        try:
            snippet = body_chunk.decode('utf-8', errors='replace')
        except Exception:
            snippet = repr(body_chunk)

        return FetchDigest(
            url=effective_url,
            status_code=status_code,
            headers_safe=_safe_headers(resp_headers),
            body_snippet=snippet,
            body_hash=body_hash,
            body_truncated=truncated,
            elapsed_ms=round(elapsed_ms, 2),
            impersonate_profile=profile_name,
            error=None,
        )

    except Exception as exc:
        elapsed_ms = (time.monotonic() - start) * 1000
        return FetchDigest(
            url=effective_url,
            status_code=0,
            headers_safe={},
            body_snippet='',
            body_hash='',
            body_truncated=False,
            elapsed_ms=round(elapsed_ms, 2),
            impersonate_profile=profile_name,
            error=str(exc),
        )


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write('usage: vanguard-fetch <json_descriptor>\n')
        sys.exit(1)

    descriptor = json.loads(sys.argv[1])
    digest = vanguard_fetch(
        url=descriptor['url'],
        method=descriptor.get('method', 'GET'),
        headers=descriptor.get('headers'),
        body=descriptor.get('body'),
        config=descriptor.get('config'),
    )
    sys.stdout.write(json.dumps(asdict(digest), indent=2) + '\n')


if __name__ == '__main__':
    main()
