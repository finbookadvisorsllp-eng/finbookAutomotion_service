"""
AI Agent Platform API Routes.
Provides API endpoints for triggering AI Agent workflows, passing custom historical execution dates, and querying historical AI reports.
"""
from typing import Optional, Dict, Any, List
from datetime import date
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.anjalee.agents.platform import (
    orchestrator_graph,
    execution_manager,
    report_storage,
    agent_logger,
    UnifiedIntelligenceReport,
    ReportMetaData,
    BaseReportSection
)

router = APIRouter(prefix="/agent", tags=["AI Agent Platform"])


class AgentRunRequest(BaseModel):
    company_id: Optional[str] = Field(default=None, description="Optional target company ID override. Defaults to request header or 'default'")
    execution_date: Optional[str] = Field(default=None, description="Optional target date in YYYY-MM-DD format (e.g. '2026-07-20') to test historical data")
    execution_time: Optional[str] = Field(default=None, description="Optional target time in HH:MM format (e.g. '18:00') to test execution time")
    goal: Optional[str] = Field(default="Execute End of Day Accounting Intelligence", description="Custom execution goal statement for AI Orchestrator")


@router.get("/config", summary="Get Active AI Agent Platform Configuration")
async def get_agent_config():
    """
    Returns active backend user configurations freshly from .env file.
    """
    from app.anjalee.agents.platform import _read_env_config
    dev_date, scheduled_time, run_on_startup = _read_env_config()
    return {
        "success": True,
        "dev_override_date": dev_date,
        "default_scheduled_time": scheduled_time,
        "run_scheduler_on_startup": run_on_startup
    }


@router.post("/run", summary="Trigger End of Day AI Accounting Intelligence Workflow")
async def run_agent_workflow(payload: AgentRunRequest, request: Request):
    """
    Triggers the LangGraph AI Orchestrator workflow.
    Supports passing any historical date in `execution_date` (e.g., '2026-07-20') to evaluate past accounting data.
    """
    # 1. Resolve Company ID (Header x-company-id > payload.company_id > default)
    header_company = request.headers.get("x-company-id") or request.headers.get("x-company")
    target_company = payload.company_id or header_company or "default"
    target_date = payload.execution_date or date.today().isoformat()
    goal = payload.goal or "Execute End of Day Accounting Intelligence"

    agent_logger.info(f"API /agent/run invoked for company '{target_company}', date '{target_date}', goal: '{goal}'")

    try:
        # 2. Create Execution State
        state = execution_manager.create_execution(
            company_id=target_company,
            current_goal=goal,
            execution_date=target_date
        )

        # 3. Run LangGraph Orchestrator Engine
        final_state = orchestrator_graph.run_workflow(state)
        final_result = final_state.get("final_result", {})
        merged_outputs = final_result.get("merged_structured_outputs", {})

        # Extract Daily Summary Agent output
        daily_summary_data = merged_outputs.get("daily_summary_agent", {}).get("data", {})
        exec_summary = daily_summary_data.get("executive_summary", "Execution completed successfully.")
        biz_insights = daily_summary_data.get("business_insights", [])
        rec_actions = daily_summary_data.get("recommended_followup_actions", [])

        # Extract Narration Quality Agent output
        narration_data = merged_outputs.get("narration_quality_agent", {}).get("data", {})

        # 4. Construct Unified Report and Save to Storage
        report_meta = ReportMetaData(
            report_id=f"rpt_{state.execution_id}",
            execution_id=state.execution_id,
            company_id=target_company
        )

        sections = [
            BaseReportSection(
                section_title="Today's Accounting Operations Summary",
                summary=exec_summary,
                metrics={
                    "voucher_summary": daily_summary_data.get("voucher_summary", {}),
                    "master_summary": daily_summary_data.get("master_summary", {}),
                    "ocr_summary": daily_summary_data.get("ocr_summary", {}),
                    "approval_summary": daily_summary_data.get("approval_summary", {}),
                    "audit_summary": daily_summary_data.get("audit_summary", {}),
                    "business_summary": daily_summary_data.get("business_summary", ""),
                    "warnings": daily_summary_data.get("warnings", [])
                },
                findings=biz_insights
            )
        ]

        if narration_data and "summary" in narration_data:
            summary = narration_data.get("summary", {})
            summary_desc = (
                f"Narration quality check analysed {summary.get('total_vouchers_analysed', 0)} total vouchers today, "
                f"finding {summary.get('excellent_count', 0)} excellent, {summary.get('good_count', 0)} good, "
                f"{summary.get('needs_improvement_count', 0)} needs improvement, and {summary.get('poor_count', 0)} poor narrations. "
                f"Average quality score: {summary.get('average_quality_score', 0)}/100."
            )
            sections.append(
                BaseReportSection(
                    section_title="Narration Quality Analysis",
                    summary=summary_desc,
                    metrics=narration_data,
                    findings=[]
                )
            )

        report = UnifiedIntelligenceReport(
            metadata=report_meta,
            executive_summary=exec_summary,
            health_score=95.0,
            sections=sections,
            overall_recommendations=rec_actions
        )

        saved_report_id = report_storage.save_report(company_id=target_company, report=report)

        target_time = payload.execution_time or "18:00"
        return {
            "success": True,
            "message": "AI Agent Platform execution completed successfully.",
            "execution_id": state.execution_id,
            "company_id": target_company,
            "execution_date": target_date,
            "execution_time": target_time,
            "report_id": saved_report_id,
            "status": final_result.get("status", "COMPLETED"),
            "executed_agents": final_result.get("executed_agents", []),
            "executive_summary": exec_summary,
            "structured_outputs": merged_outputs,
            "execution_logs": final_state.get("logs", [])
        }
    except Exception as e:
        agent_logger.error(f"Error in API /agent/run: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Agent execution failed: {str(e)}"
        )


@router.get("/reports", summary="List Historical AI Intelligence Reports")
async def list_reports(request: Request, company_id: Optional[str] = None, limit: int = 20):
    """
    Returns historical AI Accounting Intelligence Reports saved in MongoDB for the tenant company.
    """
    header_company = request.headers.get("x-company-id") or request.headers.get("x-company")
    target_company = company_id or header_company or "default"
    
    reports = report_storage.list_reports(company_id=target_company, limit=limit)
    return {
        "success": True,
        "company_id": target_company,
        "count": len(reports),
        "reports": reports
    }


@router.get("/reports/{report_id}", summary="Get Historical AI Intelligence Report by ID")
async def get_report_by_id(report_id: str, request: Request, company_id: Optional[str] = None):
    """
    Retrieves a specific historical AI Accounting Intelligence Report by report_id.
    """
    header_company = request.headers.get("x-company-id") or request.headers.get("x-company")
    target_company = company_id or header_company or "default"
    
    report = report_storage.load_report(company_id=target_company, report_id=report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{report_id}' not found for company '{target_company}'"
        )
    return {
        "success": True,
        "company_id": target_company,
        "report": report
    }
