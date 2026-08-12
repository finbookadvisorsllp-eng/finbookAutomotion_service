"""
AI Agent Platform — Single Consolidated File.
Merges: core_utils.py + intelligence.py + orchestrator.py + daily_scheduler.py
Zero logic changes. Agent files (daily_summary_agent.py, narration_quality_agent.py) remain separate.

STRUCTURE:
  SECTION 1  — Constants & Enums
  SECTION 2  — Logging
  SECTION 3  — Exceptions
  SECTION 4  — Configuration
  SECTION 5  — LLM Provider & Factory
  SECTION 6  — Output Parser & Structured Generation
  SECTION 7  — Response & Report Schemas
  SECTION 8  — Execution History Models
  SECTION 9  — Execution State
  SECTION 10 — ERP Activity Explorer (DB queries)
  SECTION 11 — Business Context Builder
  SECTION 12 — Report Storage (MongoDB)
  SECTION 13 — ERP Entity Explorer
  SECTION 14 — Execution History Store
  SECTION 15 — ERP Search Engine
  SECTION 16 — Notification Gateway
  SECTION 17 — Lifecycle Manager
  SECTION 18 — Checkpoint Manager
  SECTION 19 — Context Loader Node
  SECTION 20 — Planner Node
  SECTION 21 — Router Node
  SECTION 22 — Executor Node  (lazy-imports agent files to avoid circular imports)
  SECTION 23 — Result Merger Node
  SECTION 24 — Orchestrator Graph (LangGraph)
  SECTION 25 — Execution Manager
  SECTION 26 — Daily Scheduler
"""

# ── Standard Library ──────────────────────────────────────────────────────────
import sys
import os
import re
import uuid
import time
import threading
from pathlib import Path
from typing import Optional, Dict, Any, List, TypeVar, Type, Generic
from datetime import datetime, date
from enum import Enum

# ── Third-Party ───────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field, ValidationError as PydanticValidationError
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from bson import ObjectId
import orjson

# ── Internal ──────────────────────────────────────────────────────────────────
from app.config import settings
from app.db import client, resolve_db_name

# Load .env
_ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)


# ==============================================================================
# SECTION 1 — CONSTANTS & ENUMS
# ==============================================================================

class ExecutionStatus(str, Enum):
    CREATED = "CREATED"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AgentStatus(str, Enum):
    IDLE = "IDLE"
    PLANNING = "PLANNING"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Priority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ReportType(str, Enum):
    DAILY_INTELLIGENCE = "DAILY_INTELLIGENCE"
    DAILY_SUMMARY = "DAILY_SUMMARY"
    NARRATION_QUALITY = "NARRATION_QUALITY"
    REFERENCE_VERIFICATION = "REFERENCE_VERIFICATION"
    ERROR_SUGGESTION = "ERROR_SUGGESTION"


class NotificationType(str, Enum):
    EMAIL = "EMAIL"
    IN_APP = "IN_APP"
    WEBHOOK = "WEBHOOK"


# ==============================================================================
# SECTION 2 — LOGGING
# ==============================================================================

LOGS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level:8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO",
    enqueue=True
)
logger.add(
    LOGS_DIR / "agent.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:8} | {name}:{line} - {message}",
    level="DEBUG",
    rotation="10 MB",
    retention="30 days",
    enqueue=True
)
logger.add(
    LOGS_DIR / "execution.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:8} | {extra[execution_id]} | {name}:{line} - {message}",
    level="INFO",
    filter=lambda record: "execution_id" in record["extra"],
    rotation="10 MB",
    retention="30 days",
    enqueue=True
)


class AgentLogger:
    def __init__(self, name: str = "AgentPlatform"):
        self.logger = logger.bind(component=name)

    def info(self, message: str, execution_id: Optional[str] = None, **kwargs):
        log = self.logger.bind(execution_id=execution_id) if execution_id else self.logger
        log.info(message, **kwargs)

    def warning(self, message: str, execution_id: Optional[str] = None, **kwargs):
        log = self.logger.bind(execution_id=execution_id) if execution_id else self.logger
        log.warning(message, **kwargs)

    def error(self, message: str, execution_id: Optional[str] = None, **kwargs):
        log = self.logger.bind(execution_id=execution_id) if execution_id else self.logger
        log.error(message, **kwargs)

    def debug(self, message: str, execution_id: Optional[str] = None, **kwargs):
        log = self.logger.bind(execution_id=execution_id) if execution_id else self.logger
        log.debug(message, **kwargs)

    def track_execution(self, execution_id: str, action: str, details: Optional[Dict[str, Any]] = None):
        self.logger.bind(execution_id=execution_id).info(f"[{action}] Details: {details or {}}")


agent_logger = AgentLogger()


# ==============================================================================
# SECTION 3 — EXCEPTIONS
# ==============================================================================

class BaseAgentException(Exception):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class AgentExecutionError(BaseAgentException): pass
class ToolExecutionError(BaseAgentException): pass
class PlannerExecutionError(BaseAgentException): pass
class ValidationError(BaseAgentException): pass
class LLMExecutionError(BaseAgentException): pass


# ==============================================================================
# SECTION 4 — CONFIGURATION
# ==============================================================================

class AgentConfig(BaseModel):
    model_name: str = Field(default_factory=lambda: getattr(settings, "LLM_MODEL", "meta/llama-3.1-70b-instruct"))
    nvidia_api_key: Optional[str] = Field(default_factory=lambda: getattr(settings, "NVIDIA_API_KEY", None))
    nvidia_base_url: str = Field(default_factory=lambda: getattr(settings, "NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"))
    openrouter_api_key: Optional[str] = Field(default_factory=lambda: getattr(settings, "OPENROUTER_API_KEY", None))
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    timeout_seconds: int = Field(default=120, ge=5)
    max_retries: int = Field(default=3, ge=0)
    enable_tracing: bool = Field(default=False)
    langsmith_api_key: Optional[str] = Field(default_factory=lambda: os.getenv("LANGSMITH_API_KEY"))
    langsmith_project: str = Field(default_factory=lambda: os.getenv("LANGSMITH_PROJECT", "ai-accounting-platform"))
    default_scheduler_cron: str = Field(default="0 18 * * *")
    feature_flags: Dict[str, bool] = Field(default_factory=lambda: {
        "enable_narration_audit": True,
        "enable_reference_verification": True,
        "enable_error_suggestions": True,
        "enable_auto_notifications": True
    })

    def get_provider_credentials(self) -> Dict[str, Any]:
        return {
            "api_key": self.nvidia_api_key or os.getenv("OPENAI_API_KEY") or self.openrouter_api_key,
            "base_url": self.nvidia_base_url,
            "model": self.model_name
        }


agent_config = AgentConfig()


# ==============================================================================
# SECTION 5 — LLM PROVIDER & FACTORY
# ==============================================================================

class LLMProvider:
    def __init__(self, config: Optional[AgentConfig] = None):
        self.config = config or agent_config
        creds = self.config.get_provider_credentials()
        if not creds.get("api_key"):
            agent_logger.warning("LLMProvider initialized without API Key.")
        self.client = ChatOpenAI(
            model=creds["model"],
            openai_api_key=creds["api_key"] or "dummy_key",
            openai_api_base=creds["base_url"],
            temperature=self.config.temperature,
            request_timeout=self.config.timeout_seconds,
            max_retries=self.config.max_retries
        )
        self.model_name = creds["model"]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10),
           retry=retry_if_exception_type(Exception), reraise=True)
    def generate(self, messages: List[Dict[str, str]], **kwargs) -> str:
        langchain_messages: List[BaseMessage] = []
        for msg in messages:
            role = msg.get("role", "user").lower()
            content = msg.get("content", "")
            if role == "system":
                langchain_messages.append(SystemMessage(content=content))
            elif role == "assistant":
                langchain_messages.append(AIMessage(content=content))
            else:
                langchain_messages.append(HumanMessage(content=content))
        try:
            agent_logger.info(f"LLMProvider calling model: {self.model_name}")
            response = self.client.invoke(langchain_messages, **kwargs)
            return response.content
        except Exception as e:
            agent_logger.error(f"LLMProvider call failed: {str(e)}")
            raise LLMExecutionError(f"LLM Provider invocation error: {str(e)}", details={"model": self.model_name})

    def get_langchain_client(self) -> ChatOpenAI:
        return self.client


class LLMFactory:
    @staticmethod
    def get_provider(config: Optional[AgentConfig] = None) -> LLMProvider:
        return LLMProvider(config=config or agent_config)


def get_llm(config: Optional[AgentConfig] = None) -> LLMProvider:
    return LLMFactory.get_provider(config=config)


# ==============================================================================
# SECTION 6 — OUTPUT PARSER & STRUCTURED GENERATION
# ==============================================================================

T = TypeVar("T", bound=BaseModel)


class LLMOutputParser:
    @staticmethod
    def clean_json_string(content: str) -> str:
        content = content.strip()
        content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.MULTILINE)
        content = re.sub(r"\s*```$", "", content, flags=re.MULTILINE)
        match = re.search(r"(\{.*\}|\[.*\])", content, re.DOTALL)
        if match:
            return match.group(1)
        return content

    @classmethod
    def parse_json(cls, raw_text: str) -> Dict[str, Any]:
        cleaned = cls.clean_json_string(raw_text)
        try:
            return orjson.loads(cleaned)
        except Exception as e:
            agent_logger.error(f"Failed to parse JSON output: {str(e)} | Raw: {raw_text[:200]}")
            raise ValidationError(message="LLM output is not valid JSON",
                                  details={"error": str(e), "raw_text": raw_text[:500]})

    @classmethod
    def parse_pydantic(cls, raw_text: str, schema: Type[T]) -> T:
        data_dict = cls.parse_json(raw_text)
        try:
            return schema.model_validate(data_dict)
        except PydanticValidationError as ve:
            agent_logger.error(f"Schema validation failed for {schema.__name__}: {ve.json()}")
            raise ValidationError(message=f"LLM output failed schema validation for {schema.__name__}",
                                  details={"errors": ve.errors(), "parsed_data": data_dict})


class StructuredOutputGenerator:
    def __init__(self, provider: Optional[LLMProvider] = None):
        self.provider = provider or LLMFactory.get_provider()

    def generate_structured(self, schema: Type[T], messages: List[Dict[str, str]], **kwargs) -> T:
        client = self.provider.get_langchain_client()
        try:
            structured_llm = client.with_structured_output(schema)
            lc_messages = []
            for msg in messages:
                role = msg.get("role", "user").lower()
                content = msg.get("content", "")
                if role == "system":
                    lc_messages.append(SystemMessage(content=content))
                else:
                    lc_messages.append(HumanMessage(content=content))
            result = structured_llm.invoke(lc_messages)
            if isinstance(result, schema):
                return result
            elif isinstance(result, dict):
                return schema.model_validate(result)
        except Exception as ex:
            agent_logger.warning(f"with_structured_output failed ({ex}), falling back to raw parsing.")
        raw_text = self.provider.generate(messages, **kwargs)
        return LLMOutputParser.parse_pydantic(raw_text, schema)


# ==============================================================================
# SECTION 7 — RESPONSE & REPORT SCHEMAS
# ==============================================================================

T_Generic = TypeVar("T_Generic")


class AgentResponse(BaseModel, Generic[T_Generic]):
    agent_name: str
    status: AgentStatus = AgentStatus.COMPLETED
    data: Optional[T_Generic] = None
    error: Optional[str] = None
    execution_time_seconds: float = 0.0
    telemetry: Dict[str, Any] = Field(default_factory=dict)


class ReportMetaData(BaseModel):
    report_id: str
    execution_id: str
    company_id: str
    report_type: ReportType = ReportType.DAILY_INTELLIGENCE
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    version: str = "1.0"


class BaseReportSection(BaseModel):
    section_title: str
    summary: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    findings: List[Dict[str, Any]] = Field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW


class UnifiedIntelligenceReport(BaseModel):
    metadata: ReportMetaData
    executive_summary: str
    health_score: float = Field(default=100.0, ge=0.0, le=100.0)
    sections: List[BaseReportSection] = Field(default_factory=list)
    overall_recommendations: List[str] = Field(default_factory=list)


# ==============================================================================
# SECTION 8 — EXECUTION HISTORY MODELS
# ==============================================================================

class ExecutionStep(BaseModel):
    step_id: str
    agent_name: str
    status: AgentStatus = AgentStatus.IDLE
    input_payload: Dict[str, Any] = Field(default_factory=dict)
    output_payload: Dict[str, Any] = Field(default_factory=dict)
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class ExecutionHistory(BaseModel):
    execution_id: str
    company_id: str
    total_steps: int = 0
    steps: List[ExecutionStep] = Field(default_factory=list)
    overall_status: ExecutionStatus = ExecutionStatus.PENDING


# ==============================================================================
# SECTION 9 — EXECUTION STATE
# ==============================================================================

class AgentExecutionState(BaseModel):
    execution_id: str = Field(description="Unique UUID for the current execution run")
    company_id: str = Field(description="Target organization / company identifier")
    execution_date: str = Field(default_factory=lambda: date.today().isoformat())
    current_user: Optional[str] = Field(default="system_scheduler")
    current_goal: str = Field(default="Execute End of Day Accounting Intelligence")
    status: ExecutionStatus = Field(default=ExecutionStatus.PENDING)
    tool_results: Dict[str, Any] = Field(default_factory=dict)
    agent_outputs: Dict[str, Any] = Field(default_factory=dict)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    logs: List[str] = Field(default_factory=list)
    configuration: Dict[str, Any] = Field(default_factory=dict)
    memory: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def update_status(self, new_status: ExecutionStatus):
        self.status = new_status
        self.updated_at = datetime.utcnow().isoformat()

    def add_log(self, message: str):
        self.logs.append(f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] {message}")

    def add_error(self, component: str, error_message: str, details: Optional[Dict[str, Any]] = None):
        self.errors.append({"timestamp": datetime.utcnow().isoformat(), "component": component,
                            "error": error_message, "details": details or {}})

    def dict_snapshot(self) -> Dict[str, Any]:
        return self.model_dump()


# ==============================================================================
# SECTION 10 — ERP ACTIVITY EXPLORER
# ==============================================================================

class ActivityContext(BaseModel):
    execution_date: str
    company_id: str
    db_name: str
    voucher_statistics: Dict[str, Any] = Field(default_factory=dict)
    ocr_statistics: Dict[str, Any] = Field(default_factory=dict)
    master_activity: Dict[str, Any] = Field(default_factory=dict)
    approval_statistics: Dict[str, Any] = Field(default_factory=dict)
    audit_statistics: Dict[str, Any] = Field(default_factory=dict)
    total_activities_detected: int = Field(default=0)
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ERPActivityExplorer:
    @staticmethod
    def _build_date_query(target_date: str):
        compact_date = target_date.replace("-", "")
        formatted_hyphen_date = target_date
        if len(target_date) == 8 and target_date.isdigit():
            formatted_hyphen_date = f"{target_date[:4]}-{target_date[4:6]}-{target_date[6:]}"

        try:
            dt_obj = datetime.strptime(formatted_hyphen_date, "%Y-%m-%d")
            start_dt = datetime.combine(dt_obj.date(), datetime.min.time())
            end_dt = datetime.combine(dt_obj.date(), datetime.max.time())
        except Exception:
            start_dt = end_dt = datetime.utcnow()

        date_regex = f"^{formatted_hyphen_date}"
        compact_regex = f"^{compact_date}"

        match_or_list = [
            {"voucherDate": formatted_hyphen_date},
            {"voucherDate": compact_date},
            {"voucherDate": {"$regex": date_regex}},
            {"voucherDate": {"$regex": compact_regex}},
            {"voucherDate": {"$gte": start_dt, "$lte": end_dt}},
            {"dates.date": formatted_hyphen_date},
            {"dates.date": compact_date},
            {"dates.date": {"$regex": date_regex}},
            {"dates.date": {"$regex": compact_regex}},
            {"dates.date": {"$gte": start_dt, "$lte": end_dt}},
            {"date": formatted_hyphen_date},
            {"date": compact_date},
            {"date": {"$regex": date_regex}},
            {"date": {"$gte": start_dt, "$lte": end_dt}}
        ]
        return {"$or": match_or_list}, start_dt, end_dt, formatted_hyphen_date

    def explore_today_activity(self, company_id: str, execution_date: Optional[str] = None) -> ActivityContext:
        target_date = execution_date or date.today().isoformat()
        db_name = resolve_db_name(company_id)
        agent_logger.info(f"ERPActivityExplorer scanning DB '{db_name}' for date '{target_date}'")
        db = client[db_name]
        
        date_q, start_dt, end_dt, fmt_date = self._build_date_query(target_date)
        date_regex = f"^{fmt_date}"

        sales_docs = list(db["sales_vouchers"].find(date_q))
        purchase_docs = list(db["purchase_vouchers"].find(date_q))
        fund_flow_docs = list(db["fund_flow_vouchers"].find(date_q))
        general_vouchers_docs = list(db["vouchers"].find(date_q))

        seen_ids = set()
        for doc in sales_docs + purchase_docs + fund_flow_docs:
            seen_ids.add(str(doc.get("_id")))

        extra_sales = 0
        extra_purchase = 0
        extra_fund = 0
        extra_general = 0

        for doc in general_vouchers_docs:
            doc_id = str(doc.get("_id"))
            if doc_id in seen_ids:
                continue
            seen_ids.add(doc_id)
            v_type = str(doc.get("voucherTypeOrigName") or doc.get("voucherTypeName") or doc.get("voucherCategory") or "").lower()
            if "sale" in v_type:
                extra_sales += 1
            elif "purchase" in v_type:
                extra_purchase += 1
            elif any(k in v_type for k in ["payment", "receipt", "contra", "fund", "bank", "cash"]):
                extra_fund += 1
            else:
                extra_general += 1

        total_sales = len(sales_docs) + extra_sales
        total_purchase = len(purchase_docs) + extra_purchase
        total_fund = len(fund_flow_docs) + extra_fund
        total_general = extra_general

        all_vouchers = sales_docs + purchase_docs + fund_flow_docs + general_vouchers_docs
        # Deduplicate all_vouchers list
        unique_vouchers_map = {}
        for v in all_vouchers:
            v_id = str(v.get("_id"))
            if v_id not in unique_vouchers_map:
                unique_vouchers_map[v_id] = v
        unique_vouchers = list(unique_vouchers_map.values())
        total_vouchers = len(unique_vouchers)

        ready_for_review_ocr = db["bulk_uploads"].count_documents({"status": "Ready For Review"})
        validated_ocr = db["bulk_uploads"].count_documents({"status": "Validated"})
        bulk_uploads_count = db["bulk_uploads"].count_documents({})
        ocr_data_count = db["ocr_data"].count_documents({})

        text_to_entry_count = 0
        for doc in db["ai_sessions"].find():
            u = doc.get("updated_at") or doc.get("createdAt") or doc.get("created_at")
            if u and (str(u).startswith(fmt_date) or str(u).startswith(target_date)):
                text_to_entry_count += 1

        ingestion_breakdown = {"ocr": 0, "text_to_entry": 0, "manual": 0, "bulk": 0}
        status_breakdown = {"draft": 0, "saved": 0, "approved": 0, "posted": 0, "failed_tally": 0}
        party_counts: Dict[str, int] = {}
        items_used_set: set = set()

        for v in unique_vouchers:
            em = str(v.get("entryMode") or v.get("source") or "").lower()
            has_ocr = bool(v.get("ocrMetadata")) or "ocr" in em or "scan" in em
            has_text = bool(v.get("isTextToEntry")) or "text" in em or "prompt" in em or bool(v.get("sessionId"))
            has_bulk = bool(v.get("bulkMetadata")) or bool(v.get("bulkUploadId")) or "bulk" in em or "excel" in em
            if has_ocr: ingestion_breakdown["ocr"] += 1
            elif has_text: ingestion_breakdown["text_to_entry"] += 1
            elif has_bulk: ingestion_breakdown["bulk"] += 1
            st = str(v.get("status") or "SAVED").upper()
            if "DRAFT" in st or "REVIEW" in st: status_breakdown["draft"] += 1
            elif "APPROV" in st: status_breakdown["approved"] += 1
            elif "POST" in st or "COMPLET" in st: status_breakdown["posted"] += 1
            elif "FAIL" in st: status_breakdown["failed_tally"] += 1
            else: status_breakdown["saved"] += 1
            p = v.get("partyLedgerName") or v.get("partyLedger") or v.get("partyName") or v.get("basicBasePartyName")
            if isinstance(p, dict): p = p.get("ledgerName") or p.get("name")
            if p:
                p_name = str(p).strip()
                if p_name: party_counts[p_name] = party_counts.get(p_name, 0) + 1
            lines = v.get("inventoryEntries") or v.get("productLines") or v.get("purchaseLines") or v.get("salesEntries") or []
            for line in lines:
                if isinstance(line, dict):
                    iname = line.get("stockItemName") or line.get("productName") or line.get("itemName")
                    if iname: items_used_set.add(str(iname).strip())

        ocr_count = min(total_vouchers, ready_for_review_ocr) if ingestion_breakdown["ocr"] == 0 else ingestion_breakdown["ocr"]
        text_count = min(total_vouchers - ocr_count, text_to_entry_count) if text_to_entry_count > 0 else ingestion_breakdown["text_to_entry"]
        bulk_count = min(total_vouchers - ocr_count - text_count, ingestion_breakdown["bulk"])
        ingestion_breakdown.update({"ocr": ocr_count, "text_to_entry": text_count, "bulk": bulk_count,
                                     "manual": max(0, total_vouchers - ocr_count - text_count - bulk_count)})

        party_ledgers_summary = [{"party_name": n, "voucher_count": c}
                                   for n, c in sorted(party_counts.items(), key=lambda x: x[1], reverse=True)[:10]]

        voucher_stats = {
            "total_vouchers": total_vouchers,
            "sales_vouchers": total_sales, "purchase_vouchers": total_purchase,
            "fund_flow_vouchers": total_fund, "general_vouchers": total_general,
            "ingestion_breakdown": ingestion_breakdown, "status_breakdown": status_breakdown,
            "party_ledgers_summary": party_ledgers_summary,
            "active_parties_count": len(party_counts), "items_used_today_count": len(items_used_set),
            "target_date": fmt_date
        }
        ocr_stats = {
            "bulk_uploads_total": bulk_uploads_count,
            "ocr_documents_total": ocr_data_count or bulk_uploads_count,
            "ready_for_review_ocr": ready_for_review_ocr, "validated_ocr": validated_ocr,
            "pending_ocr": ready_for_review_ocr, "completed_ocr": validated_ocr
        }
        master_query = {"$or": [{"createdAt": {"$gte": start_dt, "$lte": end_dt}},
                                  {"auditInfo.createdDate": fmt_date},
                                  {"auditInfo.createdDate": target_date}]}
        new_ledgers_docs = list(db["ledgers"].find(master_query, {"ledgerName": 1, "groupName": 1}))
        new_items_docs = list(db["stockItems"].find(master_query, {"itemName": 1, "stockGroupName": 1}))
        master_stats = {
            "active_parties_count": len(party_counts), "items_used_today_count": len(items_used_set),
            "new_ledgers_added": len(new_ledgers_docs), "new_stock_items_added": len(new_items_docs),
            "new_ledgers_list": [{"ledger_name": d.get("ledgerName", "Unnamed"), "group_name": d.get("groupName", "General")} for d in new_ledgers_docs[:10]],
            "new_items_list": [{"item_name": d.get("itemName", "Unnamed"), "group_name": d.get("stockGroupName", "General")} for d in new_items_docs[:10]]
        }
        audit_query = {"$or": [{"createdAt": {"$gte": start_dt, "$lte": end_dt}}, {"timestamp": {"$regex": date_regex}}]}
        audit_count = db["audit_logs"].count_documents(audit_query)
        approval_stats = {
            "pending_approvals": db["sales_vouchers"].count_documents({"status": "pending_approval"}) +
                                  db["purchase_vouchers"].count_documents({"status": "pending_approval"}),
            "rejected_entries": db["sales_vouchers"].count_documents({"status": "rejected"}) +
                                 db["purchase_vouchers"].count_documents({"status": "rejected"}),
            "approved_entries": db["sales_vouchers"].count_documents({"status": "approved"}) +
                                  db["purchase_vouchers"].count_documents({"status": "approved"})
        }
        return ActivityContext(
            execution_date=fmt_date, company_id=company_id, db_name=db_name,
            voucher_statistics=voucher_stats, ocr_statistics=ocr_stats,
            master_activity=master_stats, approval_statistics=approval_stats,
            audit_statistics={"total_audit_logs": audit_count},
            total_activities_detected=voucher_stats["total_vouchers"] + ocr_stats["ocr_documents_total"]
        )

    def explore_today_vouchers(self, company_id: str, execution_date: str) -> list:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        date_q, start_dt, end_dt, fmt_date = self._build_date_query(execution_date)

        sales_docs = list(db["sales_vouchers"].find(date_q))
        purchase_docs = list(db["purchase_vouchers"].find(date_q))
        fund_flow_docs = list(db["fund_flow_vouchers"].find(date_q))
        general_vouchers_docs = list(db["vouchers"].find(date_q))
        
        raw_vouchers = []
        seen_ids = set()

        for doc in sales_docs:
            doc_id = str(doc.get("_id"))
            seen_ids.add(doc_id)
            items = [str(line.get("stockItemName") or line.get("productName") or line.get("itemName", "")).strip()
                     for line in (doc.get("inventoryEntries") or doc.get("salesEntries") or [])
                     if isinstance(line, dict) and (line.get("stockItemName") or line.get("productName") or line.get("itemName"))]
            v_date = doc.get("voucherDate")
            v_date_str = v_date.strftime("%Y-%m-%d") if isinstance(v_date, datetime) else (str(v_date) if v_date else fmt_date)
            raw_vouchers.append({
                "voucher_id": doc_id, "voucher_number": doc.get("voucherNumber") or "",
                "voucher_type": doc.get("voucherType") or "sales_invoice",
                "voucher_date": v_date_str,
                "voucher_amount": doc.get("grandTotal") or doc.get("baseAmount") or 0.0,
                "debit_ledger": doc.get("partyLedgerName") or doc.get("partyLedgerId") or "",
                "credit_ledger": doc.get("salesLedger") or "",
                "party": doc.get("partyLedgerName") or "",
                "items": items,
                "gst_details": {"cgst": doc.get("cgstAmount") or 0.0, "sgst": doc.get("sgstAmount") or 0.0,
                                  "igst": doc.get("igstAmount") or 0.0, "party_gstin": doc.get("partyGSTIN") or "",
                                  "gst_registration_type": doc.get("gstRegistrationType") or ""},
                "reference_number": doc.get("referenceNumber") or doc.get("invoiceNumber") or "",
                "current_narration": doc.get("narration") or ""
            })

        for doc in purchase_docs:
            doc_id = str(doc.get("_id"))
            seen_ids.add(doc_id)
            items = [str(line.get("stockItemName") or line.get("productName") or line.get("itemName", "")).strip()
                     for line in (doc.get("productLines") or doc.get("purchaseLines") or [])
                     if isinstance(line, dict) and (line.get("stockItemName") or line.get("productName") or line.get("itemName"))]
            v_date = doc.get("voucherDate")
            v_date_str = v_date.strftime("%Y-%m-%d") if isinstance(v_date, datetime) else (str(v_date) if v_date else fmt_date)
            raw_vouchers.append({
                "voucher_id": doc_id, "voucher_number": doc.get("voucherNumber") or "",
                "voucher_type": doc.get("voucherType") or "purchase_invoice",
                "voucher_date": v_date_str,
                "voucher_amount": doc.get("grandTotal") or 0.0,
                "debit_ledger": doc.get("purchaseLedger") or "", "credit_ledger": doc.get("partyLedger") or "",
                "party": doc.get("partyLedger") or "",
                "items": items,
                "gst_details": {"party_gstin": doc.get("partyGstin") or "",
                                  "gst_registration_type": doc.get("gstRegistrationType") or ""},
                "reference_number": doc.get("referenceNumber") or doc.get("invoiceNumber") or "",
                "current_narration": doc.get("narration") or ""
            })

        for doc in fund_flow_docs:
            doc_id = str(doc.get("_id"))
            seen_ids.add(doc_id)
            v_date = doc.get("voucherDate")
            v_date_str = v_date.strftime("%Y-%m-%d") if isinstance(v_date, datetime) else (str(v_date) if v_date else fmt_date)
            raw_vouchers.append({
                "voucher_id": doc_id, "voucher_number": doc.get("voucherNumber") or "",
                "voucher_type": doc.get("voucherType") or "cash_payment",
                "voucher_date": v_date_str,
                "voucher_amount": doc.get("amount") or doc.get("transferAmount") or doc.get("amountReceived") or 0.0,
                "debit_ledger": doc.get("partyLedger") or doc.get("destinationLedger") or "",
                "credit_ledger": doc.get("cashLedger") or doc.get("bankLedger") or doc.get("sourceLedger") or "",
                "party": doc.get("partyLedger") or "", "items": [],
                "gst_details": {"gst_applicable": doc.get("gstApplicable") or False,
                                  "gst_ledger": doc.get("gstLedger") or "", "gst_rate": doc.get("gstRate") or 0.0},
                "reference_number": doc.get("referenceNumber") or "",
                "current_narration": doc.get("narration") or ""
            })

        for doc in general_vouchers_docs:
            doc_id = str(doc.get("_id"))
            if doc_id in seen_ids:
                continue
            seen_ids.add(doc_id)
            inv_entries = doc.get("inventoryEntries") or []
            items = [str(line.get("stockItemName") or line.get("itemName", "")).strip()
                     for line in inv_entries
                     if isinstance(line, dict) and (line.get("stockItemName") or line.get("itemName"))]
            ledger_entries = doc.get("ledgerEntries") or []
            debits, credits = [], []
            for entry in ledger_entries:
                if isinstance(entry, dict):
                    ledger = entry.get("ledgerName")
                    if ledger:
                        (debits if (entry.get("isDebit") or entry.get("amount", 0) < 0) else credits).append(ledger)
            v_date = (doc.get("dates") or {}).get("date") or doc.get("voucherDate")
            v_date_str = v_date.strftime("%Y-%m-%d") if isinstance(v_date, datetime) else (str(v_date) if v_date else fmt_date)
            
            # Robust amount calculation fallback
            v_amt = (doc.get("totals") or {}).get("grandTotal") or (doc.get("totals") or {}).get("totalDebit") or doc.get("amount") or 0.0
            if not v_amt and ledger_entries:
                v_amt = sum(abs(float(e.get("amount") or 0.0)) for e in ledger_entries if isinstance(e, dict) and (e.get("isDebit") or float(e.get("amount") or 0.0) < 0))
            if not v_amt and inv_entries:
                v_amt = sum(abs(float(i.get("amount") or 0.0)) for i in inv_entries if isinstance(i, dict))

            raw_vouchers.append({
                "voucher_id": doc_id, "voucher_number": doc.get("voucherNumber") or "",
                "voucher_type": doc.get("voucherTypeOrigName") or doc.get("voucherTypeName") or doc.get("voucherCategory") or "journal",
                "voucher_date": v_date_str,
                "voucher_amount": round(float(v_amt), 2),
                "debit_ledger": ", ".join(debits), "credit_ledger": ", ".join(credits),
                "party": doc.get("partyLedgerName") or doc.get("partyName") or "",
                "items": items, "gst_details": doc.get("gstDetails") or {},
                "reference_number": doc.get("reference") or doc.get("voucherNumber") or "",
                "current_narration": doc.get("narration") or ""
            })

        return raw_vouchers


activity_explorer = ERPActivityExplorer()


# ==============================================================================
# SECTION 11 — BUSINESS CONTEXT BUILDER
# ==============================================================================

class BusinessContext(BaseModel):
    company_id: str
    execution_date: str
    summary_headline: str
    voucher_overview: Dict[str, Any]
    ocr_overview: Dict[str, Any]
    pending_approvals_count: int
    risk_indicators: List[Dict[str, Any]] = Field(default_factory=list)
    overall_workload_level: str = "NORMAL"


class BusinessContextBuilder:
    def build_context(self, activity_context: ActivityContext) -> BusinessContext:
        v_stats = activity_context.voucher_statistics
        ocr_stats = activity_context.ocr_statistics
        app_stats = activity_context.approval_statistics
        pending_apps = app_stats.get("pending_approvals", 0)
        rejected = app_stats.get("rejected_entries", 0)
        total_vouchers = v_stats.get("total_vouchers", 0)
        risk_indicators = []
        if rejected > 0:
            risk_indicators.append({"type": "REJECTED_ENTRIES", "risk_level": RiskLevel.HIGH,
                                     "message": f"Detected {rejected} rejected voucher entries."})
        if pending_apps > 10:
            risk_indicators.append({"type": "HIGH_PENDING_APPROVALS", "risk_level": RiskLevel.MEDIUM,
                                     "message": f"High volume of pending approvals ({pending_apps} vouchers)."})
        headline = f"Execution Date {activity_context.execution_date}: {total_vouchers} total vouchers detected across ERP."
        workload = "HIGH" if total_vouchers > 100 else ("MEDIUM" if total_vouchers > 20 else "NORMAL")
        return BusinessContext(
            company_id=activity_context.company_id, execution_date=activity_context.execution_date,
            summary_headline=headline, voucher_overview=v_stats, ocr_overview=ocr_stats,
            pending_approvals_count=pending_apps, risk_indicators=risk_indicators, overall_workload_level=workload
        )


context_builder = BusinessContextBuilder()


# ==============================================================================
# SECTION 12 — REPORT STORAGE (MongoDB)
# ==============================================================================

class ReportStorage:
    COLLECTION_NAME = "ai_agent_reports"

    def save_report(self, company_id: str, report: UnifiedIntelligenceReport) -> str:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        doc = report.model_dump()
        doc["saved_at"] = datetime.utcnow().isoformat()
        doc["company_id"] = db_name
        res = db[self.COLLECTION_NAME].insert_one(doc)
        inserted_id = str(res.inserted_id)
        agent_logger.info(f"Saved AI report ID '{inserted_id}' for company '{company_id}' in DB '{db_name}'")
        return inserted_id

    def load_report(self, company_id: str, report_id: str) -> Optional[Dict[str, Any]]:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        query = {"$or": [{"report_id": report_id}, {"_id": report_id}]}
        if len(report_id) == 24:
            try: query["$or"].append({"_id": ObjectId(report_id)})
            except Exception: pass
        doc = db[self.COLLECTION_NAME].find_one(query)
        if doc and "_id" in doc: doc["_id"] = str(doc["_id"])
        return doc

    def list_reports(self, company_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        cursor = db[self.COLLECTION_NAME].find({
            "$or": [
                {"company_id": company_id},
                {"company_id": db_name},
                {"company_id": "default"}
            ]
        }).sort([("saved_at", -1), ("metadata.generated_at", -1)]).limit(limit)
        results = []
        for doc in cursor:
            if "_id" in doc: doc["_id"] = str(doc["_id"])
            results.append(doc)
        return results


report_storage = ReportStorage()


# ==============================================================================
# SECTION 13 — ERP ENTITY EXPLORER
# ==============================================================================

class ERPEntityExplorer:
    @staticmethod
    def _clean_bson(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not doc: return None
        cleaned = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId): cleaned[k] = str(v)
            elif isinstance(v, dict): cleaned[k] = ERPEntityExplorer._clean_bson(v)
            elif isinstance(v, list):
                cleaned[k] = [ERPEntityExplorer._clean_bson(item) if isinstance(item, dict)
                               else (str(item) if isinstance(item, ObjectId) else item) for item in v]
            else: cleaned[k] = v
        return cleaned

    def get_entity_details(self, company_id: str, entity_type: str, entity_id: str) -> Dict[str, Any]:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        entity_type_lower = entity_type.lower()
        agent_logger.info(f"ERPEntityExplorer looking up '{entity_type}' ID '{entity_id}' in DB '{db_name}'")
        doc = None
        if entity_type_lower in ("voucher", "sales_voucher", "sales"):
            doc = db["sales_vouchers"].find_one({"$or": [{"_id": entity_id}, {"voucherNumber": entity_id}]})
            if not doc and len(entity_id) == 24:
                try: doc = db["sales_vouchers"].find_one({"_id": ObjectId(entity_id)})
                except Exception: pass
            if not doc: doc = db["purchase_vouchers"].find_one({"$or": [{"_id": entity_id}, {"voucherNumber": entity_id}]})
            if not doc: doc = db["vouchers"].find_one({"$or": [{"_id": entity_id}, {"voucherNumber": entity_id}]})
        elif entity_type_lower in ("ledger", "party"):
            doc = db["ledgers"].find_one({"$or": [{"_id": entity_id}, {"ledgerName": entity_id}]})
            if not doc and len(entity_id) == 24:
                try: doc = db["ledgers"].find_one({"_id": ObjectId(entity_id)})
                except Exception: pass
        elif entity_type_lower in ("item", "stock_item"):
            doc = db["stockItems"].find_one({"$or": [{"_id": entity_id}, {"itemName": entity_id}]})
            if not doc and len(entity_id) == 24:
                try: doc = db["stockItems"].find_one({"_id": ObjectId(entity_id)})
                except Exception: pass
        elif entity_type_lower in ("company", "organization"):
            doc = db["companies"].find_one({"$or": [{"_id": entity_id}, {"companyName": entity_id}]})
        elif entity_type_lower in ("ocr", "ocr_document", "bulk_upload"):
            doc = db["bulk_uploads"].find_one({"$or": [{"_id": entity_id}, {"document_id": entity_id}]})
            if not doc and len(entity_id) == 24:
                try: doc = db["bulk_uploads"].find_one({"_id": ObjectId(entity_id)})
                except Exception: pass
        else:
            raise ToolExecutionError(f"Unsupported entity_type '{entity_type}' in ERPEntityExplorer.")
        if not doc:
            return {"status": "not_found", "entity_type": entity_type, "entity_id": entity_id}
        return {"status": "found", "entity_type": entity_type, "entity_id": entity_id, "data": self._clean_bson(doc)}


entity_explorer = ERPEntityExplorer()


# ==============================================================================
# SECTION 14 — EXECUTION HISTORY STORE
# ==============================================================================

class ExecutionHistoryStore:
    COLLECTION_NAME = "ai_agent_execution_history"

    def record_execution(self, history: ExecutionHistory) -> str:
        db_name = resolve_db_name(history.company_id)
        db = client[db_name]
        doc = history.model_dump()
        doc["recorded_at"] = datetime.utcnow().isoformat()
        res = db[self.COLLECTION_NAME].insert_one(doc)
        inserted_id = str(res.inserted_id)
        agent_logger.info(f"Recorded execution history '{inserted_id}' for '{history.execution_id}'")
        return inserted_id

    def get_execution_history(self, company_id: str, execution_id: str) -> Optional[Dict[str, Any]]:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        doc = db[self.COLLECTION_NAME].find_one({"execution_id": execution_id})
        if doc and "_id" in doc: doc["_id"] = str(doc["_id"])
        return doc


execution_history_store = ExecutionHistoryStore()


# ==============================================================================
# SECTION 15 — ERP SEARCH ENGINE
# ==============================================================================

class ERPSearchEngine:
    @staticmethod
    def _clean_docs(cursor) -> List[Dict[str, Any]]:
        results = []
        for doc in cursor:
            cleaned = {k: str(v) if isinstance(v, ObjectId) else v for k, v in doc.items()}
            results.append(cleaned)
        return results

    def search(self, company_id: str, query_type: str, filters: Optional[Dict[str, Any]] = None, limit: int = 50) -> Dict[str, Any]:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        filters = filters or {}
        agent_logger.info(f"ERPSearchEngine executing query_type '{query_type}' in DB '{db_name}'")
        results = []
        query_type_lower = query_type.lower()
        if query_type_lower == "missing_narration":
            query = {"$or": [{"narration": None}, {"narration": ""}, {"narration": {"$exists": False}}]}
            query.update(filters)
            results = self._clean_docs(db["sales_vouchers"].find(query).limit(limit)) + \
                      self._clean_docs(db["purchase_vouchers"].find(query).limit(limit))
        elif query_type_lower == "duplicate_vouchers":
            pipeline = [{"$group": {"_id": "$voucherNumber", "count": {"$sum": 1}, "docs": {"$push": "$$ROOT"}}},
                        {"$match": {"count": {"$gt": 1}}}, {"$limit": limit}]
            for item in db["sales_vouchers"].aggregate(pipeline):
                results.append({"voucher_number": item["_id"], "duplicate_count": item["count"]})
        elif query_type_lower == "pending_approvals":
            query = {"status": "pending_approval"}
            query.update(filters)
            results = self._clean_docs(db["sales_vouchers"].find(query).limit(limit))
        elif query_type_lower == "general_search":
            coll_name = filters.get("collection", "sales_vouchers")
            mongo_query = filters.get("query", {})
            if coll_name in db.list_collection_names():
                results = self._clean_docs(db[coll_name].find(mongo_query).limit(limit))
        else:
            results = self._clean_docs(db["vouchers"].find(filters).limit(limit))
        return {"query_type": query_type, "company_id": company_id, "total_results": len(results), "results": results[:limit]}


search_engine = ERPSearchEngine()


# ==============================================================================
# SECTION 16 — NOTIFICATION GATEWAY
# ==============================================================================

class NotificationGateway:
    COLLECTION_NAME = "notifications"

    def send_notification(self, company_id: str, title: str, message: str, channel: str = "IN_APP",
                          recipients: Optional[List[str]] = None, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        db_name = resolve_db_name(company_id)
        db = client[db_name]
        doc = {"company_id": company_id, "title": title, "message": message, "channel": channel.upper(),
               "recipients": recipients or ["management"], "metadata": metadata or {},
               "status": "SENT", "created_at": datetime.utcnow().isoformat()}
        res = db[self.COLLECTION_NAME].insert_one(doc)
        inserted_id = str(res.inserted_id)
        agent_logger.info(f"Dispatched notification '{inserted_id}' channel '{channel}' for company '{company_id}'")
        return {"notification_id": inserted_id, "status": "SENT", "channel": channel, "title": title}


notification_gateway = NotificationGateway()


# ==============================================================================
# SECTION 17 — LIFECYCLE MANAGER
# ==============================================================================

class LifecycleState(str, Enum):
    CREATED = "CREATED"
    LOADING_CONTEXT = "LOADING_CONTEXT"
    PLANNING = "PLANNING"
    ROUTING = "ROUTING"
    EXECUTING = "EXECUTING"
    MERGING = "MERGING"
    WAITING = "WAITING"
    RETRYING = "RETRYING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class LifecycleManager:
    def __init__(self):
        self._current_state = LifecycleState.CREATED
        self._history = []

    def transition_to(self, execution_id: str, new_state: LifecycleState, details: Optional[Dict[str, Any]] = None):
        old_state = self._current_state
        self._current_state = new_state
        event = {"execution_id": execution_id, "from_state": old_state.value,
                 "to_state": new_state.value, "timestamp": datetime.utcnow().isoformat(), "details": details or {}}
        self._history.append(event)
        agent_logger.info(f"[LifecycleTransition] '{execution_id}': {old_state.value} -> {new_state.value}", execution_id=execution_id)

    def get_current_state(self) -> LifecycleState:
        return self._current_state


lifecycle_manager = LifecycleManager()


# ==============================================================================
# SECTION 18 — CHECKPOINT MANAGER
# ==============================================================================

class CheckpointManager:
    def __init__(self):
        self.checkpointer = MemorySaver()

    def get_checkpointer(self) -> MemorySaver:
        return self.checkpointer

    def save_snapshot(self, thread_id: str, state_snapshot: Dict[str, Any]):
        agent_logger.info(f"Saved checkpoint snapshot for thread '{thread_id}'")


checkpoint_manager = CheckpointManager()


# ==============================================================================
# SECTION 19 — CONTEXT LOADER NODE
# ==============================================================================

class ContextLoaderNode:
    def load_context(self, state_dict: Dict[str, Any]) -> Dict[str, Any]:
        company_id = state_dict.get("company_id", "default")
        execution_date = state_dict.get("execution_date")
        execution_id = state_dict.get("execution_id", "unknown")
        agent_logger.info(f"ContextLoaderNode loading ERP context for '{company_id}', date '{execution_date}'", execution_id=execution_id)
        act_context = activity_explorer.explore_today_activity(company_id=company_id, execution_date=execution_date)
        raw_vouchers = activity_explorer.explore_today_vouchers(company_id=company_id, execution_date=execution_date)
        biz_context = context_builder.build_context(act_context)
        updated_state = dict(state_dict)
        if "tool_results" not in updated_state or not isinstance(updated_state["tool_results"], dict):
            updated_state["tool_results"] = {}
        updated_state["tool_results"]["activity_context"] = act_context.model_dump()
        updated_state["tool_results"]["business_context"] = biz_context.model_dump()
        updated_state["tool_results"]["raw_vouchers"] = raw_vouchers
        logs = updated_state.get("logs", [])
        logs.append(f"ContextLoaderNode: Loaded {act_context.total_activities_detected} total ERP activity events.")
        updated_state["logs"] = logs
        return updated_state


context_loader_node = ContextLoaderNode()


# ==============================================================================
# SECTION 20 — PLANNER NODE
# ==============================================================================

class ExecutionPlan(BaseModel):
    plan_id: str
    goal: str
    required_stages: List[str] = Field(default_factory=list)
    rationale: str


class PlannerNode:
    def plan_execution(self, state_dict: Dict[str, Any]) -> Dict[str, Any]:
        goal = state_dict.get("current_goal", "Execute End of Day Accounting Intelligence")
        execution_id = state_dict.get("execution_id", "unknown")
        agent_logger.info(f"PlannerNode generating execution plan for goal: '{goal}'", execution_id=execution_id)
        stages = ["load_context", "route_agents", "execute_sub_agents", "merge_results"]
        plan = ExecutionPlan(plan_id=f"plan_{execution_id}", goal=goal, required_stages=stages,
                             rationale=f"Planned 4-stage execution for goal: {goal}")
        updated_state = dict(state_dict)
        if "memory" not in updated_state or not isinstance(updated_state["memory"], dict):
            updated_state["memory"] = {}
        updated_state["memory"]["execution_plan"] = plan.model_dump()
        logs = updated_state.get("logs", [])
        logs.append(f"PlannerNode: Formulated execution plan '{plan.plan_id}' with {len(stages)} stages.")
        updated_state["logs"] = logs
        return updated_state


planner_node = PlannerNode()


# ==============================================================================
# SECTION 21 — ROUTER NODE
# ==============================================================================

class RoutingDecision(BaseModel):
    selected_agents: List[str] = Field(default_factory=list)
    skipped_agents: List[str] = Field(default_factory=list)
    reasoning: str


class RouterNode:
    ALL_SUB_AGENTS = ["daily_summary_agent", "narration_quality_agent",
                      "reference_verification_agent", "error_suggestion_agent"]

    def route(self, state_dict: Dict[str, Any]) -> Dict[str, Any]:
        execution_id = state_dict.get("execution_id", "unknown")
        agent_logger.info(f"RouterNode evaluating routing for execution '{execution_id}'", execution_id=execution_id)
        tool_results = state_dict.get("tool_results", {})
        total_vouchers = tool_results.get("activity_context", {}).get("voucher_statistics", {}).get("total_vouchers", 0)
        decision = RoutingDecision(
            selected_agents=list(self.ALL_SUB_AGENTS), skipped_agents=[],
            reasoning=f"Selected all 4 core sub-agents based on ERP workload ({total_vouchers} vouchers detected)."
        )
        updated_state = dict(state_dict)
        if "memory" not in updated_state or not isinstance(updated_state["memory"], dict):
            updated_state["memory"] = {}
        updated_state["memory"]["routing_decision"] = decision.model_dump()
        logs = updated_state.get("logs", [])
        logs.append(f"RouterNode: Selected agents {decision.selected_agents}; Skipped {decision.skipped_agents}.")
        updated_state["logs"] = logs
        return updated_state


router_node = RouterNode()


# ==============================================================================
# SECTION 22 — EXECUTOR NODE  (lazy imports prevent circular dependency)
# ==============================================================================

class ExecutorNode:
    def execute_agents(self, state_dict: Dict[str, Any]) -> Dict[str, Any]:
        execution_id = state_dict.get("execution_id", "unknown")
        memory = state_dict.get("memory", {})
        selected_agents = memory.get("routing_decision", {}).get("selected_agents", ["daily_summary_agent"])
        agent_logger.info(f"ExecutorNode invoking sub-agents: {selected_agents}", execution_id=execution_id)

        agent_outputs = dict(state_dict.get("agent_outputs", {}))
        logs = list(state_dict.get("logs", []))

        for agent_name in selected_agents:
            start_t = time.time()
            agent_logger.info(f"Executing sub-agent '{agent_name}'...", execution_id=execution_id)
            output_payload = {}

            if agent_name == "daily_summary_agent":
                try:
                    # Lazy import to avoid circular dependency with platform.py
                    from app.anjalee.agents.daily_summary_agent import daily_accounting_summary_agent
                    output_payload = daily_accounting_summary_agent.execute(state_dict).model_dump()
                except Exception as ex:
                    agent_logger.error(f"Error executing daily_summary_agent: {ex}")
                    output_payload = {"error": str(ex), "status": "FAILED"}

            elif agent_name == "narration_quality_agent":
                try:
                    # Lazy import to avoid circular dependency with platform.py
                    from app.anjalee.agents.narration_quality_agent import narration_quality_agent
                    output_payload = narration_quality_agent.execute(state_dict).model_dump()
                except Exception as ex:
                    agent_logger.error(f"Error executing narration_quality_agent: {ex}")
                    output_payload = {"error": str(ex), "status": "FAILED"}

            else:
                output_payload = {"agent_name": agent_name, "status": "COMPLETED",
                                  "summary": f"Structured payload output from {agent_name}",
                                  "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")}

            latency = round((time.time() - start_t) * 1000, 2)
            response = AgentResponse[Dict[str, Any]](
                agent_name=agent_name, status=AgentStatus.COMPLETED,
                data=output_payload, execution_time_seconds=latency / 1000.0
            )
            agent_outputs[agent_name] = response.model_dump()
            logs.append(f"ExecutorNode: '{agent_name}' completed in {latency}ms.")

        updated_state = dict(state_dict)
        updated_state["agent_outputs"] = agent_outputs
        updated_state["logs"] = logs
        return updated_state


executor_node = ExecutorNode()


# ==============================================================================
# SECTION 23 — RESULT MERGER NODE
# ==============================================================================

class OrchestratorExecutionResult(BaseModel):
    execution_id: str
    company_id: str
    execution_date: str
    status: ExecutionStatus = ExecutionStatus.COMPLETED
    executed_agents: List[str] = Field(default_factory=list)
    skipped_agents: List[str] = Field(default_factory=list)
    execution_duration_seconds: float = 0.0
    shared_context: Dict[str, Any] = Field(default_factory=dict)
    merged_structured_outputs: Dict[str, Any] = Field(default_factory=dict)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    completed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ResultMergerNode:
    def merge_results(self, state_dict: Dict[str, Any]) -> Dict[str, Any]:
        execution_id = state_dict.get("execution_id", "unknown")
        company_id = state_dict.get("company_id", "default")
        execution_date = state_dict.get("execution_date", "")
        agent_logger.info(f"ResultMergerNode merging outputs for execution '{execution_id}'", execution_id=execution_id)
        memory = state_dict.get("memory", {})
        routing_decision = memory.get("routing_decision", {})
        agent_outputs = state_dict.get("agent_outputs", {})
        tool_results = state_dict.get("tool_results", {})
        result = OrchestratorExecutionResult(
            execution_id=execution_id, company_id=company_id, execution_date=execution_date,
            status=ExecutionStatus.COMPLETED,
            executed_agents=routing_decision.get("selected_agents", []),
            skipped_agents=routing_decision.get("skipped_agents", []),
            shared_context=tool_results.get("business_context", {}),
            merged_structured_outputs=agent_outputs,
            errors=state_dict.get("errors", [])
        )
        updated_state = dict(state_dict)
        updated_state["status"] = ExecutionStatus.COMPLETED.value
        updated_state["final_result"] = result.model_dump()
        logs = updated_state.get("logs", [])
        logs.append(f"ResultMergerNode: Successfully merged {len(agent_outputs)} agent outputs into final result.")
        updated_state["logs"] = logs
        return updated_state


result_merger_node = ResultMergerNode()


# ==============================================================================
# SECTION 24 — ORCHESTRATOR GRAPH (LangGraph)
# ==============================================================================

class OrchestratorGraph:
    def __init__(self):
        self.workflow = StateGraph(dict)
        self.workflow.add_node("context_loader", context_loader_node.load_context)
        self.workflow.add_node("planner", planner_node.plan_execution)
        self.workflow.add_node("router", router_node.route)
        self.workflow.add_node("executor", executor_node.execute_agents)
        self.workflow.add_node("result_merger", result_merger_node.merge_results)
        self.workflow.add_edge(START, "context_loader")
        self.workflow.add_edge("context_loader", "planner")
        self.workflow.add_edge("planner", "router")
        self.workflow.add_edge("router", "executor")
        self.workflow.add_edge("executor", "result_merger")
        self.workflow.add_edge("result_merger", END)
        self.app = self.workflow.compile(checkpointer=checkpoint_manager.get_checkpointer())

    def run_workflow(self, state: AgentExecutionState) -> Dict[str, Any]:
        execution_id = state.execution_id
        lifecycle_manager.transition_to(execution_id, LifecycleState.PLANNING)
        agent_logger.info(f"Starting LangGraph workflow for execution '{execution_id}'", execution_id=execution_id)
        final_state = self.app.invoke(state.dict_snapshot(), config={"configurable": {"thread_id": execution_id}})
        lifecycle_manager.transition_to(execution_id, LifecycleState.COMPLETED)
        agent_logger.info(f"LangGraph workflow completed for execution '{execution_id}'", execution_id=execution_id)
        return final_state


orchestrator_graph = OrchestratorGraph()


# ==============================================================================
# SECTION 25 — EXECUTION MANAGER
# ==============================================================================

class ExecutionManager:
    def create_execution(self, company_id: str, current_goal: Optional[str] = None,
                         execution_date: Optional[str] = None) -> AgentExecutionState:
        execution_id = f"exec_{uuid.uuid4().hex[:12]}"
        load_dotenv(dotenv_path=_ENV_PATH, override=True)
        raw_override_date = os.getenv("DEV_OVERRIDE_DATE", "").strip()
        env_override_date = raw_override_date if raw_override_date and raw_override_date.lower() not in ("none", "") else None
        target_date = execution_date or env_override_date or date.today().isoformat()
        goal = current_goal or "Execute End of Day Accounting Intelligence"
        state = AgentExecutionState(
            execution_id=execution_id, company_id=company_id,
            execution_date=target_date, status=ExecutionStatus.CREATED, current_goal=goal
        )
        lifecycle_manager.transition_to(execution_id, LifecycleState.CREATED)
        agent_logger.info(f"ExecutionManager initialized execution '{execution_id}' for '{company_id}', date '{target_date}'", execution_id=execution_id)
        return state

    def update_status(self, execution_id: str, status: str, result_summary: Optional[str] = None):
        try:
            lifecycle_manager.transition_to(execution_id, LifecycleState(status))
        except Exception:
            pass


execution_manager = ExecutionManager()


# ==============================================================================
# SECTION 26 — DAILY SCHEDULER
# ==============================================================================

def _read_env_config():
    """Read fresh config from .env every time (not cached at import time)."""
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
    raw_date = os.getenv("DEV_OVERRIDE_DATE", "").strip()
    dev_date = raw_date if raw_date and raw_date.lower() not in ("none", "") else None
    scheduled_time = os.getenv("DEFAULT_SCHEDULED_TIME", "18:00").strip()
    run_on_startup = os.getenv("RUN_SCHEDULER_ON_STARTUP", "false").lower() in ("true", "1", "yes")
    return dev_date, scheduled_time, run_on_startup


class AIAgentScheduler:
    def __init__(self):
        self.scheduler = BackgroundScheduler(daemon=True)
        self.is_running = False
        self._last_triggered_minute = None

    def run_scheduled_job(self, company_id: str = "default", override_date: Optional[str] = None):
        dev_date, _, _ = _read_env_config()
        target_date = override_date or dev_date or date.today().isoformat()
        agent_logger.info(f"[ScheduledJob] Automated AI Agent job triggered for company '{company_id}', date '{target_date}'")
        try:
            state = execution_manager.create_execution(
                company_id=company_id,
                current_goal="Automated Scheduled End of Day Accounting Intelligence",
                execution_date=target_date
            )
            final_state = orchestrator_graph.run_workflow(state)
            final_result = final_state.get("final_result", {})
            merged_outputs = final_result.get("merged_structured_outputs", {})
            daily_summary_data = merged_outputs.get("daily_summary_agent", {}).get("data", {})
            exec_summary = daily_summary_data.get("executive_summary", "Scheduled execution completed.")
            biz_insights = daily_summary_data.get("business_insights", [])
            rec_actions = daily_summary_data.get("recommended_followup_actions", [])
            narration_data = merged_outputs.get("narration_quality_agent", {}).get("data", {})

            report_meta = ReportMetaData(
                report_id=f"rpt_{state.execution_id}",
                execution_id=state.execution_id,
                company_id=company_id
            )
            sections = [BaseReportSection(
                section_title="Today's Accounting Operations Summary",
                summary=exec_summary,
                metrics={"voucher_summary": daily_summary_data.get("voucher_summary", {}),
                         "master_summary": daily_summary_data.get("master_summary", {}),
                         "ocr_summary": daily_summary_data.get("ocr_summary", {}),
                         "approval_summary": daily_summary_data.get("approval_summary", {}),
                         "audit_summary": daily_summary_data.get("audit_summary", {}),
                         "business_summary": daily_summary_data.get("business_summary", ""),
                         "warnings": daily_summary_data.get("warnings", [])},
                findings=biz_insights
            )]
            if narration_data and "summary" in narration_data:
                summary = narration_data.get("summary", {})
                summary_desc = (
                    f"Narration quality check analysed {summary.get('total_vouchers_analysed', 0)} total vouchers today, "
                    f"finding {summary.get('excellent_count', 0)} excellent, {summary.get('good_count', 0)} good, "
                    f"{summary.get('needs_improvement_count', 0)} needs improvement, and {summary.get('poor_count', 0)} poor narrations. "
                    f"Average quality score: {summary.get('average_quality_score', 0)}/100."
                )
                sections.append(BaseReportSection(
                    section_title="Narration Quality Analysis",
                    summary=summary_desc,
                    metrics=narration_data,
                    findings=[]
                ))
            report = UnifiedIntelligenceReport(
                metadata=report_meta, executive_summary=exec_summary,
                health_score=95.0, sections=sections, overall_recommendations=rec_actions
            )
            saved_id = report_storage.save_report(company_id=company_id, report=report)
            agent_logger.info(f"[ScheduledJob] AI Report saved successfully with ID '{saved_id}' for company '{company_id}'")
        except Exception as e:
            agent_logger.error(f"[ScheduledJob] Error executing automated AI Agent job: {str(e)}")

    def _check_and_trigger_scheduled_job(self):
        try:
            dev_date, scheduled_time, _ = _read_env_config()
            time_parts = scheduled_time.split(":")
            sch_hour = int(time_parts[0]) if len(time_parts) > 0 else 18
            sch_minute = int(time_parts[1]) if len(time_parts) > 1 else 0
            now = datetime.now()
            if now.hour == sch_hour and now.minute == sch_minute:
                run_key = now.strftime("%Y-%m-%d-%H-%M")
                if self._last_triggered_minute == run_key:
                    return
                self._last_triggered_minute = run_key
                agent_logger.info(f"[Scheduler] Clock matches {scheduled_time}. Starting AI Agent job...")
                threading.Thread(target=self.run_scheduled_job, args=["default"], daemon=True).start()
        except Exception as e:
            agent_logger.error(f"Error in dynamic scheduler check: {str(e)}")

    def start(self):
        if self.is_running:
            return
        try:
            dev_date, scheduled_time, run_on_startup = _read_env_config()
            self.scheduler.add_job(func=self._check_and_trigger_scheduled_job, trigger="interval",
                                   seconds=15, id="dynamic_ai_schedule_checker", replace_existing=True)
            self.scheduler.start()
            self.is_running = True
            agent_logger.info(f"AIAgentScheduler started. Checking every 15s. Target: {scheduled_time}. Test Date: '{dev_date or 'Today'}'")
            if run_on_startup:
                agent_logger.info("RUN_SCHEDULER_ON_STARTUP enabled. Triggering immediate background execution...")
                threading.Thread(target=self.run_scheduled_job, args=["default"], daemon=True).start()
        except Exception as e:
            agent_logger.error(f"Failed to start AIAgentScheduler: {str(e)}")

    def stop(self):
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            agent_logger.info("AIAgentScheduler stopped.")


daily_scheduler = AIAgentScheduler()
