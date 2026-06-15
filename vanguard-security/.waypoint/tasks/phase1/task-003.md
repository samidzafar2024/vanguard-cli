# Task 003: vanguardFetch — OPSEC HTTP Egress Layer

**Phase**: Phase 1
**Depends on**: Task 001 (EngagementConfig for rate_limit, ua_bundle, fireprox fields)
**Estimated**: 1 session
**Labels**: phase1, opsec

## What to build

Python module `vanguard-fetch.py` inside the Docker worker container.
All HTTP requests from agents go through this instead of raw `curl` or `httpx`.

## Files to create

- `apps/worker/src/docker/vanguard-fetch.py` — NEW: Python module + CLI
- `apps/worker/src/docker/requirements-opsec.txt` — NEW: `curl_cffi>=0.7.0`

## What to implement

### `vanguard-fetch.py`

```python
#!/usr/bin/env python3
"""
vanguardFetch — OPSEC-aware HTTP egress for Vanguard agents.
All agent HTTP requests go through this. Never call curl/httpx directly.
"""

import json, sys, time, random, hashlib
from dataclasses import dataclass, asdict
from curl_cffi import requests as cffi_requests

UA_BUNDLES = {
    "chrome131_mac": "chrome131",
    "chrome130_win": "chrome130",
    "firefox134_linux": "firefox133",
    "safari18_mac": "safari18",
}

@dataclass
class FetchDigest:
    status: int
    content_type: str
    body_truncated: str       # first 8KB only
    response_time_ms: int
    tls_fingerprint_matched: bool
    headers_safe: dict        # no Set-Cookie, no Authorization
    body_hash: str            # sha256 of full body before truncation
    error: str | None

def vanguard_fetch(url, method="GET", headers=None, body=None, config=None) -> FetchDigest:
    config = config or {}
    rps = config.get("rate_limit_rps", 2)
    ua_bundle = UA_BUNDLES.get(config.get("ua_bundle", "chrome131_mac"), "chrome131")
    fireprox = config.get("fireprox_gateway")
    bug_bounty = config.get("bug_bounty_handle")

    # Rate limiting with jitter
    delay = (1 / rps) * random.uniform(0.7, 1.3)
    time.sleep(delay)

    # FireProx URL rewriting
    fetch_url = url
    if fireprox:
        fetch_url = fireprox.rstrip("/") + "/" + url.split("://", 1)[-1]

    # Build headers
    req_headers = dict(headers or {})
    if bug_bounty:
        req_headers["X-Bug-Bounty"] = bug_bounty

    # Execute with curl_cffi (Chrome TLS fingerprint)
    start = time.time()
    try:
        resp = cffi_requests.request(
            method, fetch_url,
            headers=req_headers,
            data=body,
            impersonate=ua_bundle,
            timeout=30,
            allow_redirects=True,
        )
        elapsed = int((time.time() - start) * 1000)

        raw_body = resp.content
        body_hash = hashlib.sha256(raw_body).hexdigest()
        body_str = raw_body[:8192].decode("utf-8", errors="replace")

        safe_headers = {
            k: v for k, v in resp.headers.items()
            if k.lower() not in ("set-cookie", "authorization", "www-authenticate")
        }

        return FetchDigest(
            status=resp.status_code,
            content_type=resp.headers.get("content-type", ""),
            body_truncated=body_str,
            response_time_ms=elapsed,
            tls_fingerprint_matched=True,
            headers_safe=safe_headers,
            body_hash=body_hash,
            error=None,
        )
    except Exception as e:
        return FetchDigest(
            status=0, content_type="", body_truncated="",
            response_time_ms=0, tls_fingerprint_matched=False,
            headers_safe={}, body_hash="", error=str(e)
        )

# CLI: python3 vanguard-fetch.py '{"url":"https://...","config":{...}}'
if __name__ == "__main__":
    inp = json.loads(sys.argv[1])
    result = vanguard_fetch(**inp)
    print(json.dumps(asdict(result)))
```

### Dockerfile update

Add to `Dockerfile` worker stage:
```dockerfile
COPY apps/worker/src/docker/requirements-opsec.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements-opsec.txt
COPY apps/worker/src/docker/vanguard-fetch.py /usr/local/bin/vanguard-fetch
RUN chmod +x /usr/local/bin/vanguard-fetch
```

## Acceptance Criteria

- [ ] `python3 vanguard-fetch.py '{"url":"https://httpbin.org/get"}'` returns valid JSON with `status: 200`
- [ ] Response body truncated to 8KB max
- [ ] `Set-Cookie` not in `headers_safe`
- [ ] Rate limiting: calling 5x in quick succession takes ≥2.5s (2 RPS default)
- [ ] `error` field is non-null on network failure (not an exception)
- [ ] `bug_bounty_handle` → `X-Bug-Bounty` header present in request
- [ ] `pnpm run check` still passes after Dockerfile change

## Notes

- `curl_cffi` is the key dependency — it matches Chrome's JA3/JA4 TLS fingerprint
- Body hash is used as `digest_hash` in quarantine pipeline (Task 004)
- FireProx rewriting: only the host+path changes, original path preserved
- Agents must call `vanguard-fetch` via subprocess or MCP tool — NEVER direct `curl`
