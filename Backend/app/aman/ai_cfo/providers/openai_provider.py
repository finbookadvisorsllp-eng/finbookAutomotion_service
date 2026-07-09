"""OpenAI chat-completions provider — implemented with the Python standard
library only (``urllib``), so the aman package adds **no** new dependency to
requirements.txt (same philosophy as ``core/security.py``).

It calls ``POST {base}/chat/completions``. Swapping to the official ``openai``
SDK later is a drop-in change behind the ``AIProvider`` interface.
"""
import json
import urllib.error
import urllib.request
from typing import Optional

from app.aman.ai_cfo.config import ai_cfo_settings as cfg
from app.aman.ai_cfo.providers.base import AIProvider, ProviderError, ProviderResult


class OpenAIProvider(AIProvider):
    """OpenAI-compatible chat provider. Subclasses (OpenRouter) only need to swap
    the api_key / model / base_url and, optionally, add ``extra_headers``."""
    name = "openai"

    def __init__(self):
        self.api_key = cfg.OPENAI_API_KEY
        self.model = cfg.OPENAI_MODEL
        self.base_url = cfg.OPENAI_BASE_URL
        self.extra_headers: dict[str, str] = {}

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _missing_key_error(self) -> str:
        return "OpenAI API key is not configured (OPENAI_API_KEY)."

    def chat(self, messages: list[dict], *, temperature: Optional[float] = None,
             max_tokens: Optional[int] = None) -> ProviderResult:
        if not self.is_configured():
            raise ProviderError(self._missing_key_error())

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": cfg.TEMPERATURE if temperature is None else temperature,
            "max_tokens": cfg.MAX_TOKENS if max_tokens is None else max_tokens,
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }
        req = urllib.request.Request(
            f"{self.base_url}/chat/completions", data=data, headers=headers, method="POST")

        label = self.name
        try:
            with urllib.request.urlopen(req, timeout=cfg.REQUEST_TIMEOUT) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = _read_error(exc)
            raise ProviderError(f"{label} HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise ProviderError(f"{label} network error: {exc.reason}") from exc
        except (TimeoutError, json.JSONDecodeError) as exc:
            raise ProviderError(f"{label} response error: {exc}") from exc

        # OpenRouter surfaces upstream failures as a 200 body with an ``error`` key.
        if isinstance(body, dict) and body.get("error") and not body.get("choices"):
            err = body["error"]
            msg = err.get("message") if isinstance(err, dict) else err
            raise ProviderError(f"{label} error: {msg}")

        try:
            text = body["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, AttributeError, TypeError) as exc:
            raise ProviderError(f"Malformed {label} response: {body}") from exc

        usage = body.get("usage", {}) or {}
        return ProviderResult(
            text=text,
            provider=self.name,
            model=body.get("model", self.model),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            raw=body,
        )

    def chat_stream(self, messages: list[dict], *, temperature: Optional[float] = None,
                    max_tokens: Optional[int] = None):
        """Stream tokens via SSE (``stream: true``). Yields the event dicts defined
        on the base class. Reads the response socket line-by-line so content appears
        as the model produces it."""
        if not self.is_configured():
            raise ProviderError(self._missing_key_error())

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": cfg.TEMPERATURE if temperature is None else temperature,
            "max_tokens": cfg.MAX_TOKENS if max_tokens is None else max_tokens,
            "stream": True,
            # Ask the gateway to send a final usage chunk (OpenAI/OpenRouter).
            "stream_options": {"include_usage": True},
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            **self.extra_headers,
        }
        req = urllib.request.Request(
            f"{self.base_url}/chat/completions", data=data, headers=headers, method="POST")
        label = self.name

        try:
            resp = urllib.request.urlopen(req, timeout=cfg.REQUEST_TIMEOUT)
        except urllib.error.HTTPError as exc:
            raise ProviderError(f"{label} HTTP {exc.code}: {_read_error(exc)}") from exc
        except urllib.error.URLError as exc:
            raise ProviderError(f"{label} network error: {exc.reason}") from exc

        model = self.model
        tokens = {"prompt": 0, "completion": 0, "total": 0}
        try:
            for raw in resp:                       # yields lines as they arrive
                line = raw.decode("utf-8", "ignore").strip()
                if not line or line.startswith(":"):   # keepalive / comment
                    continue
                if not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if chunk == "[DONE]":
                    break
                try:
                    obj = json.loads(chunk)
                except json.JSONDecodeError:
                    continue
                if obj.get("model"):
                    model = obj["model"]
                usage = obj.get("usage")
                if usage:
                    tokens = {"prompt": usage.get("prompt_tokens", 0),
                              "completion": usage.get("completion_tokens", 0),
                              "total": usage.get("total_tokens", 0)}
                choices = obj.get("choices") or []
                if choices:
                    delta = (choices[0] or {}).get("delta") or {}
                    piece = delta.get("content")
                    if piece:
                        yield {"type": "token", "text": piece}
        finally:
            try:
                resp.close()
            except Exception:  # noqa: BLE001
                pass

        yield {"type": "final", "model": model, "tokens": tokens}


class OpenRouterProvider(OpenAIProvider):
    """OpenRouter gateway — OpenAI-compatible. Gives access to free NVIDIA/other
    models via the same wire format, just a different base URL + key + attribution
    headers."""
    name = "openrouter"

    def __init__(self):
        super().__init__()
        self.api_key = cfg.OPENROUTER_API_KEY
        self.model = cfg.OPENROUTER_MODEL
        self.base_url = cfg.OPENROUTER_BASE_URL
        self.extra_headers = {
            "HTTP-Referer": cfg.OPENROUTER_REFERER,
            "X-Title": cfg.OPENROUTER_TITLE,
        }

    def _missing_key_error(self) -> str:
        return "OpenRouter API key is not configured (OPENROUTER_API_KEY)."


def _read_error(exc: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(exc.read().decode("utf-8"))
        return (payload.get("error") or {}).get("message") or str(payload)
    except Exception:  # noqa: BLE001
        return exc.reason or "unknown error"
