"""AI CFO configuration — reads the AI knobs from the shared ``.env``.

Layered exactly like ``app.aman.config``: importing that module guarantees the
``.env`` has already been loaded (it calls ``load_dotenv`` once), then we read
the AI-CFO-only settings on top. Nothing here is hardcoded or secret — the
OpenAI key lives only in the git-ignored ``Backend/.env`` (server-side).
"""
import os

# Importing the shared aman settings ensures .env is loaded exactly once.
from app.aman.config import aman_settings  # noqa: F401  (import for side effect)


def _flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


class AICFOSettings:
    # ─── Identity ───
    FEATURE_NAME: str = "AI CFO"
    ROUTE_PREFIX: str = "/ai-cfo"

    # ─── Provider selection ───
    # "openrouter" (default), "openai", or "gemini". The service resolves the
    # concrete provider from this string via the provider registry, so adding a
    # provider is a one-file change with no route/service edits. OpenRouter and
    # OpenAI share the same wire format (/chat/completions) — see providers/.
    PROVIDER: str = os.getenv("AI_CFO_PROVIDER", "openrouter").strip().lower()

    # ─── OpenAI ───
    OPENAI_API_KEY: str = (os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_APIKEY") or "").strip()
    OPENAI_MODEL: str = os.getenv("AI_CFO_OPENAI_MODEL", "gpt-4o-mini").strip()
    OPENAI_BASE_URL: str = os.getenv("AI_CFO_OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")

    # ─── OpenRouter (OpenAI-compatible gateway; free NVIDIA/other models) ───
    # Key may be supplied as OPENROUTER_API_KEY; we also accept a key placed in
    # OPENAI_API_KEY (an ``sk-or-*`` value), so switching providers is env-only.
    OPENROUTER_API_KEY: str = (
        os.getenv("OPENROUTER_API_KEY")
        or (OPENAI_API_KEY if OPENAI_API_KEY.startswith("sk-or-") else "")
    ).strip()
    OPENROUTER_MODEL: str = os.getenv(
        "AI_CFO_OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free").strip()
    OPENROUTER_BASE_URL: str = os.getenv(
        "AI_CFO_OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").strip().rstrip("/")
    # OpenRouter recommends (not requires) these for attribution/ranking.
    OPENROUTER_REFERER: str = os.getenv("AI_CFO_OPENROUTER_REFERER", "https://livetally.local").strip()
    OPENROUTER_TITLE: str = os.getenv("AI_CFO_OPENROUTER_TITLE", "LiveTally AI CFO").strip()

    # ─── Gemini (optional, future) ───
    GEMINI_API_KEY: str = (os.getenv("GEMINI_API_KEY") or "").strip()
    GEMINI_MODEL: str = os.getenv("AI_CFO_GEMINI_MODEL", "gemini-1.5-flash").strip()

    # ─── Generation ───
    MAX_TOKENS: int = int(os.getenv("AI_CFO_MAX_TOKENS", "1200"))
    TEMPERATURE: float = float(os.getenv("AI_CFO_TEMPERATURE", "0.2"))  # low = factual
    # Generous upper bound so a genuinely long analysis is never cut off. This is a
    # hard ceiling, NOT a fixed delay — the model streams the moment it is ready and
    # the response time reflects only real reasoning/search, nothing artificial.
    REQUEST_TIMEOUT: int = int(os.getenv("AI_CFO_TIMEOUT", "180"))      # seconds

    # ─── Conversation memory ───
    # How many prior (user, assistant) turns to replay into the model for context.
    HISTORY_TURNS: int = int(os.getenv("AI_CFO_HISTORY_TURNS", "8"))
    # Mongo collections (live inside each tenant's sf_tenant_<id> database).
    CONVERSATIONS_COLLECTION: str = "ai_conversations"
    SESSIONS_COLLECTION: str = "ai_sessions"
    BUSINESS_MEMORY_COLLECTION: str = "ai_business_memory"

    # ─── Safety / ops ───
    # When true (default) the AI layer degrades gracefully if the provider is
    # unreachable or unconfigured — the API still returns a helpful, grounded
    # message instead of a 500, so the rest of the app is never blocked.
    GRACEFUL_DEGRADE: bool = _flag("AI_CFO_GRACEFUL_DEGRADE", "true")

    @property
    def is_configured(self) -> bool:
        """True when the selected provider has the credentials it needs."""
        if self.PROVIDER == "openrouter":
            return bool(self.OPENROUTER_API_KEY)
        if self.PROVIDER == "openai":
            return bool(self.OPENAI_API_KEY)
        if self.PROVIDER == "gemini":
            return bool(self.GEMINI_API_KEY)
        return False

    @property
    def active_model(self) -> str:
        """The model id for the selected provider (for display / health)."""
        return {
            "openrouter": self.OPENROUTER_MODEL,
            "openai": self.OPENAI_MODEL,
            "gemini": self.GEMINI_MODEL,
        }.get(self.PROVIDER, "")


ai_cfo_settings = AICFOSettings()
