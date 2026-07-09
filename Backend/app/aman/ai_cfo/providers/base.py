"""Provider-agnostic contract for chat completions."""
from dataclasses import dataclass, field
from typing import Optional


class ProviderError(Exception):
    """Raised when a provider is misconfigured or the upstream call fails."""


@dataclass
class ProviderResult:
    text: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    raw: dict = field(default_factory=dict)


class AIProvider:
    """Minimal chat interface every provider implements.

    ``messages`` is the OpenAI-style list of ``{"role", "content"}`` dicts
    (roles: system/user/assistant). Providers translate as needed.
    """

    name: str = "base"

    def is_configured(self) -> bool:
        raise NotImplementedError

    def chat(self, messages: list[dict], *, temperature: Optional[float] = None,
             max_tokens: Optional[int] = None) -> ProviderResult:
        raise NotImplementedError

    def chat_stream(self, messages: list[dict], *, temperature: Optional[float] = None,
                    max_tokens: Optional[int] = None):
        """Stream a completion as an iterator of event dicts:

            {"type": "token", "text": "..."}      # incremental content
            {"type": "final", "model": str, "tokens": {...}}  # once, at the end

        Default: no native streaming — fall back to a single ``chat`` call and
        emit its whole text as one token so callers work uniformly.
        """
        result = self.chat(messages, temperature=temperature, max_tokens=max_tokens)
        yield {"type": "token", "text": result.text}
        yield {"type": "final", "model": result.model,
               "tokens": {"prompt": result.prompt_tokens, "completion": result.completion_tokens,
                          "total": result.total_tokens}}
