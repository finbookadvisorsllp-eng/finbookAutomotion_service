"""
Consolidated Daily Accounting Summary Agent.
Combines: prompts/daily_summary_prompt.py + sub_agents/daily_summary_agent.py
Exact same logic — only files merged.
"""
from typing import Dict, Any, List, Optional
import time
from pydantic import BaseModel, Field
from app.anjalee.agents.platform import StructuredOutputGenerator, agent_logger

# ==========================================
# SYSTEM PROMPT (previously: prompts/daily_summary_prompt.py)
# ==========================================

DAILY_SUMMARY_AGENT_PROMPT = """You are the Daily Accounting Summary Agent, an experienced Senior Accountant performing an End-of-Day operational review for an enterprise ERP system.

YOUR MISSION:
Review today's ERP activity context and answer one fundamental business question:
"What happened in today's accounting operations?"

ANALYSIS SCOPE & GUIDELINES:
1. ACCOUNTING REASONING: Do not simply count vouchers. Evaluate today's operational workload, voucher type distributions (Sales, Purchase, Payment, Receipt, Contra, Journal, Notes), new master additions (Ledgers, Parties, Stock Items), OCR processing throughput, approval bottlenecks, and audit log activities.
2. PROFESSIONAL TERMINOLOGY: Use formal accounting terminology (e.g. "Working capital flow", "Sub-ledger additions", "Unapproved postings", "Document processing throughput").
3. BUSINESS INSIGHTS GENERATION: Identify operational trends, unusual activity patterns, high workload spikes, inactive modules, and potential operational risks.
4. ACTIONABLE RECOMMENDATIONS: Provide 2-4 clear, actionable follow-up recommendations for accounting management.
5. STRICT FACTUAL ACCURACY: Base all analysis strictly on the supplied ERP activity context. Never invent missing vouchers or assume data that is not present. If context is limited, explicitly state that additional information is required.
6. STRICT STRUCTURED OUTPUT: Return ONLY a valid JSON object matching the requested schema.
"""

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class BusinessInsightItem(BaseModel):
    category: str = Field(description="Category: WORKLOAD, ANOMALY, RISK, EFFICIENCY")
    title: str = Field(description="Short insight title")
    description: str = Field(description="Detailed accounting explanation")
    impact_level: str = Field(default="MEDIUM", description="Impact level: LOW, MEDIUM, HIGH, CRITICAL")


class DailySummaryOutput(BaseModel):
    """
    Structured response returned by Daily Accounting Summary Agent.
    """
    execution_metadata: Dict[str, Any] = Field(default_factory=dict)
    executive_summary: str = Field(description="High-level senior accountant executive summary of today's work")
    business_summary: str = Field(description="Operational narrative explaining overall ERP activity")
    accounting_activity_summary: Dict[str, Any] = Field(default_factory=dict)
    voucher_summary: Dict[str, Any] = Field(default_factory=dict)
    master_summary: Dict[str, Any] = Field(default_factory=dict)
    ocr_summary: Dict[str, Any] = Field(default_factory=dict)
    approval_summary: Dict[str, Any] = Field(default_factory=dict)
    audit_summary: Dict[str, Any] = Field(default_factory=dict)
    business_insights: List[BusinessInsightItem] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    recommended_followup_actions: List[str] = Field(default_factory=list)


# ==========================================
# AGENT CLASS (previously: sub_agents/daily_summary_agent.py)
# ==========================================

class DailyAccountingSummaryAgent:
    """
    Specialized AI Agent that evaluates today's ERP context and generates an intelligent accounting summary.
    Consumes context ONLY from the Orchestrator (no direct DB access).
    """
    def __init__(self):
        self.agent_name = "daily_summary_agent"

    def execute(self, state_dict: Dict[str, Any]) -> DailySummaryOutput:
        start_time = time.time()
        execution_id = state_dict.get("execution_id", "unknown")
        company_id = state_dict.get("company_id", "default")
        execution_date = state_dict.get("execution_date", "")
        
        agent_logger.info(f"DailyAccountingSummaryAgent executing analysis for company '{company_id}', date '{execution_date}'", execution_id=execution_id)
        
        # 1. Extract context from tool results
        tool_results = state_dict.get("tool_results", {})
        act_ctx = tool_results.get("activity_context", {})
        biz_ctx = tool_results.get("business_context", {})
        
        v_stats = act_ctx.get("voucher_statistics", {})
        ocr_stats = act_ctx.get("ocr_statistics", {})
        master_stats = act_ctx.get("master_activity", {})
        app_stats = act_ctx.get("approval_statistics", {})
        audit_stats = act_ctx.get("audit_statistics", {})
        
        total_vouchers = v_stats.get("total_vouchers", 0)
        
        # Prepare system & user prompt messages
        messages = [
            {"role": "system", "content": DAILY_SUMMARY_AGENT_PROMPT},
            {"role": "user", "content": f"""Analyze today's ERP Activity Context for Company '{company_id}' on Date '{execution_date}':

Activity Context Data:
- Voucher Statistics: {v_stats}
- Master Additions/Updates: {master_stats}
- OCR Upload Throughput: {ocr_stats}
- Approval Queue Stats: {app_stats}
- Audit Log Stats: {audit_stats}
- Business Context Headline: {biz_ctx.get('summary_headline', 'N/A')}

Produce a comprehensive, structured DailySummaryOutput."""}
        ]

        # 2. Call Structured Output Generator
        try:
            generator = StructuredOutputGenerator()
            output = generator.generate_structured(DailySummaryOutput, messages)
            output.execution_metadata = {
                "execution_id": execution_id,
                "company_id": company_id,
                "execution_date": execution_date,
                "execution_time_seconds": round(time.time() - start_time, 3)
            }
            output.voucher_summary = {**v_stats, **(output.voucher_summary or {})}
            output.master_summary = {**master_stats, **(output.master_summary or {})}
            output.ocr_summary = {**ocr_stats, **(output.ocr_summary or {})}
            output.approval_summary = {**app_stats, **(output.approval_summary or {})}
            output.audit_summary = {**audit_stats, **(output.audit_summary or {})}
            return output
        except Exception as ex:
            agent_logger.warning(f"LLM call encountered issue ({ex}), constructing analytical fallback DailySummaryOutput.")
            
            # Fallback structured output generation using raw context data
            headline = f"End of Day Accounting Summary for {execution_date}: Processed {total_vouchers} total vouchers."
            exec_summary = f"Senior Accountant Review: Today's operations recorded {v_stats.get('sales_vouchers', 0)} sales vouchers, {v_stats.get('purchase_vouchers', 0)} purchase vouchers, and {v_stats.get('general_vouchers', 0)} general journal entries."
            
            insights = [
                BusinessInsightItem(
                    category="WORKLOAD",
                    title="Voucher Processing Volume",
                    description=f"Total of {total_vouchers} vouchers recorded today across all modules.",
                    impact_level="LOW" if total_vouchers < 50 else "MEDIUM"
                )
            ]
            
            if master_stats.get("total_ledgers", 0) > 0:
                insights.append(BusinessInsightItem(
                    category="EFFICIENCY",
                    title="Master Chart of Accounts",
                    description=f"Active ledger count stands at {master_stats.get('total_ledgers')} entries.",
                    impact_level="LOW"
                ))

            rec_actions = [
                "Review pending approval queues prior to day closing.",
                "Ensure all OCR uploaded documents are fully reconciled with purchase vouchers."
            ]

            return DailySummaryOutput(
                execution_metadata={
                    "execution_id": execution_id,
                    "company_id": company_id,
                    "execution_date": execution_date,
                    "execution_time_seconds": round(time.time() - start_time, 3)
                },
                executive_summary=exec_summary,
                business_summary=headline,
                accounting_activity_summary={"total_detected": act_ctx.get("total_activities_detected", 0)},
                voucher_summary=v_stats,
                master_summary=master_stats,
                ocr_summary=ocr_stats,
                approval_summary=app_stats,
                audit_summary=audit_stats,
                business_insights=insights,
                warnings=[],
                recommended_followup_actions=rec_actions
            )


# Singleton
daily_accounting_summary_agent = DailyAccountingSummaryAgent()
