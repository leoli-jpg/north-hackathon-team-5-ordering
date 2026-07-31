#!/usr/bin/env python3
"""Run a minimal OpenAI-compatible LLM smoke test.

The script intentionally prints only model/base_url metadata, never the API key.
"""

from __future__ import annotations

import os
import sys

import httpx
from openai import OpenAI


def normalize_base_url(base_url: str) -> str:
    """Append /v1 for OpenAI Python SDK when the configured gateway omits it."""
    if base_url.endswith("/v1"):
        return base_url
    return base_url.rstrip("/") + "/v1"


def main() -> int:
    if os.getenv("RUN_LLM_SMOKE", "false").strip().lower() not in {"1", "true", "yes", "on"}:
        print("LLM smoke test skipped. Set RUN_LLM_SMOKE=true to enable.")
        return 0

    api_type = os.getenv("LLM_API_TYPE", "openai").strip().lower()
    if api_type != "openai":
        print(f"Unsupported LLM_API_TYPE={api_type!r}; this smoke test only supports openai")
        return 2

    api_key = os.getenv("LLM_API_KEY", "").strip()
    base_url = os.getenv("LLM_BASE_URL", "").strip()
    model = os.getenv("LLM_MODEL", "").strip()

    missing = [name for name, value in [("LLM_API_KEY", api_key), ("LLM_BASE_URL", base_url), ("LLM_MODEL", model)] if not value]
    if missing:
        print("Missing required LLM smoke-test env vars: " + ", ".join(missing))
        return 2

    normalized_base_url = normalize_base_url(base_url)
    print(f"Running LLM smoke test for model={model!r} base_url={normalized_base_url!r}")

    client = OpenAI(
        api_key=api_key,
        base_url=normalized_base_url,
        http_client=httpx.Client(trust_env=False),
    )
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Return exactly: OK"}],
        temperature=0,
        max_tokens=16,
    )
    text = (response.choices[0].message.content or "").strip()
    print(f"LLM smoke response={text!r}")
    if not text:
        print("LLM smoke test failed: empty response")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
