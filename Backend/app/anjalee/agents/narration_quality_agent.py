"""
Consolidated Narration Quality Agent.
Combines: prompts/narration_quality_prompt.py + sub_agents/narration_quality_agent.py
Exact same logic — only files merged.
"""
from typing import Dict, Any, List, Optional
import time
from pydantic import BaseModel, Field
from app.anjalee.agents.platform import StructuredOutputGenerator, agent_logger

# ==========================================
# SYSTEM PROMPT (previously: prompts/narration_quality_prompt.py)
# ==========================================

NARRATION_QUALITY_AGENT_PROMPT = """
You are a Senior Accountant reviewing today's voucher narrations for narration quality, accounting completeness, business meaning, and clarity.

Your responsibility is to analyse the narration of each voucher and suggest improved narrations.
You must NEVER modify Tally/ERP data or suggest approving/rejecting a voucher. Your only role is to suggest improvements.

Ensure you answer the core question:
"Are today's voucher narrations complete, meaningful, and professionally written?"

### GUIDELINES FOR EVALUATION:
1. **Narration Status**:
   - `Present`: Narration exists and is reasonable.
   - `Missing`: No narration field or value is present.
   - `Blank`: Empty string.
   - `Whitespace only`: Spaces only.
   - `Very Short`: Less than 5-10 characters (e.g. "ok", "paid", "sales").
   - `Incomplete`: Unfinished sentence or key details missing.

2. **Quality Score (0 to 100)**:
   - **Excellent (90-100)**: Complete, clear, grammatical, includes party name, reference numbers/invoice numbers, and specifies exact items or service details.
   - **Good (70-89)**: Clear and meaningful, but could include more reference info.
   - **Needs Improvement (40-69)**: Lacks invoice numbers, party names, adjustment details, or has grammar/spelling errors.
   - **Poor (1-39)**: Generic narration (e.g. "payment done", "purchase voucher").
   - **Missing (0)**: Empty, blank, or whitespace only.

3. **Validation & Suggested Narration rules**:
   - **Sales Vouchers**: Suggest mentioning consignee/party, invoice/challan numbers, product/service name, and tax/GST registration info if present.
   - **Purchase Vouchers**: Suggest mentioning supplier invoice numbers, date, items purchased, and reference numbers.
   - **Payments/Receipts**: Suggest mentioning payment mode (cash, bank, check number, UTR number), purpose of payment (invoice settlement, advance, salary, utilities), and party name.
   - **Journals/Adjustments**: Suggest describing the reason for adjustment (GST adjustment, depreciation write-off, year-end accruals) and accounts involved.
   - **Contra**: Suggest mentioning cash deposition/withdrawal, bank names, branch, and instrument reference.

### ERROR HANDLING (Insufficient Context):
- If the voucher data is completely missing key fields or ledger names, mark `suggested_narration` as "Insufficient Context" and list missing fields in `issues_found`. Never invent accounting information.
"""

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class VoucherNarrationAnalysis(BaseModel):
    voucher_id: str = Field(description="Unique voucher document ID")
    voucher_number: str = Field(description="Voucher Number")
    voucher_type: str = Field(description="Voucher Type")
    current_narration: str = Field(description="Current Narration in Tally/ERP")
    narration_status: str = Field(description="Narration Status: Present, Missing, Blank, Whitespace only, Very Short, Incomplete")
    quality_score: int = Field(description="Quality score (0-100)")
    quality_level: str = Field(description="Quality Level: Excellent, Good, Needs Improvement, Poor, Missing")
    issues_found: List[str] = Field(default_factory=list, description="List of issues found e.g. Missing invoice number, spelling errors")
    suggested_narration: str = Field(description="Suggested improved professional narration")
    confidence: float = Field(description="LLM Confidence score (0.0 to 1.0)")
    reason: str = Field(description="Reason explaining the score and recommendation")


class NarrationSummary(BaseModel):
    total_vouchers_analysed: int = Field(description="Total count of vouchers analysed")
    excellent_count: int = Field(default=0, description="Count of excellent quality narrations")
    good_count: int = Field(default=0, description="Count of good quality narrations")
    needs_improvement_count: int = Field(default=0, description="Count of needs improvement quality narrations")
    poor_count: int = Field(default=0, description="Count of poor quality narrations")
    missing_count: int = Field(default=0, description="Count of missing quality narrations")
    average_quality_score: float = Field(default=0.0, description="Average quality score across analysed vouchers")
    top_issues: List[str] = Field(default_factory=list, description="Top issues observed across vouchers today")
    recommendations: List[str] = Field(default_factory=list, description="System recommendations for improving narrations")


class NarrationQualityOutput(BaseModel):
    execution_metadata: Dict[str, Any] = Field(default_factory=dict)
    vouchers_analysis: List[VoucherNarrationAnalysis] = Field(default_factory=list)
    summary: NarrationSummary


# ==========================================
# AGENT CLASS (previously: sub_agents/narration_quality_agent.py)
# ==========================================

class NarrationQualityAgent:
    """
    Evaluates narration quality of today's vouchers and suggests improvements.
    Consumes context strictly from orchestrator's tool_results.
    """
    def __init__(self):
        self.agent_name = "narration_quality_agent"

    def execute(self, state_dict: Dict[str, Any]) -> NarrationQualityOutput:
        start_time = time.time()
        execution_id = state_dict.get("execution_id", "unknown")
        company_id = state_dict.get("company_id", "default")
        execution_date = state_dict.get("execution_date", "")

        agent_logger.info(f"NarrationQualityAgent executing for company '{company_id}', date '{execution_date}'", execution_id=execution_id)

        # Extract raw vouchers list from shared context
        tool_results = state_dict.get("tool_results", {})
        raw_vouchers = tool_results.get("raw_vouchers", [])

        if not raw_vouchers:
            agent_logger.info("No raw vouchers found in context. Returning empty narration quality analysis.", execution_id=execution_id)
            return NarrationQualityOutput(
                execution_metadata={
                    "execution_id": execution_id,
                    "company_id": company_id,
                    "execution_date": execution_date,
                    "execution_time_seconds": round(time.time() - start_time, 3)
                },
                vouchers_analysis=[],
                summary=NarrationSummary(
                    total_vouchers_analysed=0,
                    average_quality_score=100.0,
                    top_issues=[],
                    recommendations=["No vouchers recorded today to analyse narration quality."]
                )
            )

        # Call Structured Output Generator
        messages = [
            {"role": "system", "content": NARRATION_QUALITY_AGENT_PROMPT},
            {"role": "user", "content": f"Review these today's vouchers for company '{company_id}' on date '{execution_date}':\n\n{raw_vouchers}\n\nProduce a complete, structured NarrationQualityOutput."}
        ]

        try:
            generator = StructuredOutputGenerator()
            output = generator.generate_structured(NarrationQualityOutput, messages)
            output.execution_metadata = {
                "execution_id": execution_id,
                "company_id": company_id,
                "execution_date": execution_date,
                "execution_time_seconds": round(time.time() - start_time, 3)
            }
            return output
        except Exception as ex:
            agent_logger.warning(f"LLM call failed ({ex}) in NarrationQualityAgent. Constructing fallback output.")
            
            # Construct a safe python fallback
            v_analyses = []
            excellent = 0
            good = 0
            needs_imp = 0
            poor = 0
            missing = 0
            total_score = 0

            for v in raw_vouchers:
                curr = str(v.get("current_narration", "")).strip()
                v_id = v.get("voucher_id", "unknown")
                v_num = v.get("voucher_number", "N/A")
                v_type = v.get("voucher_type", "voucher")
                
                if not curr:
                    status = "Missing"
                    score = 0
                    level = "Missing"
                    issues = ["Narration is blank or missing completely"]
                    suggested = f"Being {v_type.replace('_', ' ')} recorded under voucher no {v_num}."
                    reason = "Narration is completely missing from this voucher."
                    missing += 1
                elif len(curr) < 10:
                    status = "Very Short"
                    score = 45
                    level = "Needs Improvement"
                    issues = ["Narration is too short to explain business purpose"]
                    suggested = f"Being {v_type.replace('_', ' ')} for {v.get('party', 'party')} for amount {v.get('voucher_amount', 0)}."
                    reason = "Narration does not contain sufficient details about the items or transaction purpose."
                    needs_imp += 1
                else:
                    status = "Present"
                    score = 85
                    level = "Good"
                    issues = []
                    suggested = curr
                    reason = "Narration exists and explains the transaction."
                    good += 1
                
                total_score += score
                v_analyses.append(VoucherNarrationAnalysis(
                    voucher_id=v_id,
                    voucher_number=v_num,
                    voucher_type=v_type,
                    current_narration=curr or "[No Narration]",
                    narration_status=status,
                    quality_score=score,
                    quality_level=level,
                    issues_found=issues,
                    suggested_narration=suggested,
                    confidence=0.8,
                    reason=reason
                ))

            total_count = len(raw_vouchers)
            avg_score = round(total_score / total_count, 1) if total_count > 0 else 100.0

            return NarrationQualityOutput(
                execution_metadata={
                    "execution_id": execution_id,
                    "company_id": company_id,
                    "execution_date": execution_date,
                    "execution_time_seconds": round(time.time() - start_time, 3)
                },
                vouchers_analysis=v_analyses,
                summary=NarrationSummary(
                    total_vouchers_analysed=total_count,
                    excellent_count=excellent,
                    good_count=good,
                    needs_improvement_count=needs_imp,
                    poor_count=poor,
                    missing_count=missing,
                    average_quality_score=avg_score,
                    top_issues=["Missing or blank narrations on key vouchers"] if missing > 0 else [],
                    recommendations=["Ensure all transactions have complete narrations detailing invoice/reference numbers."]
                )
            )


# Singleton
narration_quality_agent = NarrationQualityAgent()
