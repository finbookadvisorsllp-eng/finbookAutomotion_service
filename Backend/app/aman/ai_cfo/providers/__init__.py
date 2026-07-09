"""AI provider abstraction + registry.

Adding a provider (e.g. Gemini) is a one-file change: implement ``AIProvider`` and
register it in ``get_provider``. The service layer only ever talks to the ABC, so
routes/prompts/context never change when the backing model does.
"""
from app.aman.ai_cfo.config import ai_cfo_settings as cfg
from app.aman.ai_cfo.providers.base import AIProvider, ProviderError, ProviderResult
from app.aman.ai_cfo.providers.openai_provider import OpenAIProvider, OpenRouterProvider

__all__ = ["AIProvider", "ProviderError", "ProviderResult", "get_provider"]


def get_provider(name: str | None = None) -> AIProvider:
    """Resolve the configured provider instance."""
    name = (name or cfg.PROVIDER or "openrouter").strip().lower()
    if name == "openrouter":
        return OpenRouterProvider()
    if name == "openai":
        return OpenAIProvider()
    # Gemini can be slotted in here without touching any caller.
    raise ProviderError(f"Unknown or unconfigured AI provider: '{name}'")
