"""Pydantic request/response schemas for the AI CFO API.

The HTTP envelope stays the shared ``{success, data, meta}`` (via ``ok``) — these
models describe the *request bodies* and the *shape of ``data``* so the frontend
has a stable contract.
"""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────── Requests ───────────────────────────────
class ChatRequest(BaseModel):
    """POST /ai-cfo/chat body."""
    message: str = Field(..., min_length=1, max_length=4000,
                         description="The user's question to the AI CFO.")
    sessionId: Optional[str] = Field(
        default=None,
        description="Continue an existing conversation. Omit to start a new one.")
    fy: Optional[str] = Field(default=None, description="Financial year, e.g. 2025-2026")


class DeleteConversationRequest(BaseModel):
    sessionId: str = Field(..., description="Session to clear.")


# ─────────────────────────────── Response fragments ───────────────────────────────
class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    createdAt: Optional[str] = None


class ChatResponse(BaseModel):
    sessionId: str
    answer: str
    # Structured extras the model may surface (grounded, never fabricated).
    highlights: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    # Which report contexts fed this answer (transparency / auditability).
    contextUsed: list[str] = Field(default_factory=list)
    provider: Optional[str] = None
    model: Optional[str] = None
    degraded: bool = False  # True when answered without a live model call


class SessionSummary(BaseModel):
    sessionId: str
    title: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    messageCount: int = 0


class Suggestion(BaseModel):
    id: str
    label: str
    prompt: str
    category: str = "general"


# ─────────────────────────────── Recommendations / alerts ───────────────────────────────
class Insight(BaseModel):
    """A deterministic, rules-engine finding (no LLM) — always reconcilable."""
    id: str
    severity: Literal["info", "warning", "danger", "success"]
    category: str
    title: str
    detail: str
    metric: Optional[str] = None
    value: Optional[Any] = None
    change: Optional[float] = None
    action: Optional[str] = None
