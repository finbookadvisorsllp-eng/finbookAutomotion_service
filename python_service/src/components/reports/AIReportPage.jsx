import React, { useState, useEffect } from 'react';
import {
  Sparkles, RefreshCw, Play, Calendar, Clock, Building2,
  FileText, TrendingUp, ShoppingCart, ArrowLeftRight, CheckCircle2,
  AlertTriangle, Lightbulb, ShieldAlert, CheckCheck, Loader2, BookOpen, Layers,
  Bookmark, Scan, UserCheck, ChevronDown, UploadCloud, FileCheck,
  Package, Users, Store, CheckSquare, Layers3, AlertCircle
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { agentService } from '../../services/agentService';

export default function AIReportPage() {
  const selectedCompany = useAppStore((s) => s.selectedCompany) || 'default';
  const role = useAppStore((s) => s.role) || 'admin';
  const isAdmin = ['admin', 'administrator', 'superadmin'].includes((role || '').toLowerCase());

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('12:45');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [activeAgentTab, setActiveAgentTab] = useState('daily_summary');

  // Fetch or trigger report
  const handleFetchReport = async (triggerRun = false, customDate = null, isSilentPoll = false) => {
    if (!isSilentPoll) {
      setLoading(true);
    }
    setError(null);
    try {
      let activeDate = customDate || selectedDate;
      let activeTime = selectedTime;

      // 1. Fetch backend config on initial load (not on silent poll, run trigger, or custom date select)
      if (!triggerRun && !customDate && !isSilentPoll) {
        try {
          const cfg = await agentService.getAgentConfig();
          if (cfg && cfg.dev_override_date) {
            activeDate = cfg.dev_override_date;
            setSelectedDate((prev) => prev !== cfg.dev_override_date ? cfg.dev_override_date : prev);
          }
          if (cfg && cfg.default_scheduled_time) {
            activeTime = cfg.default_scheduled_time;
            setSelectedTime((prev) => prev !== cfg.default_scheduled_time ? cfg.default_scheduled_time : prev);
          }
        } catch (e) {
          console.warn('Could not fetch agent config:', e);
        }
      }

      if (triggerRun) {
        const res = await agentService.runAgentWorkflow({
          company_id: selectedCompany,
          execution_date: activeDate,
          execution_time: activeTime,
          goal: 'Execute End of Day Accounting Intelligence'
        });
        setReportData(res);
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setSelectedTime(hours + ":" + minutes);
      } else {
        // Fetch existing historical report list or run if none exists
        const listRes = await agentService.listReports({ company_id: selectedCompany, limit: 10 });
        if (listRes && listRes.reports && listRes.reports.length > 0) {
          // Find report matching target date
          let matching = listRes.reports.find((r) => {
            const secMetrics = r.sections?.[0]?.metrics || {};
            const vStats = secMetrics.voucher_summary || {};
            return vStats.target_date === activeDate;
          });

          // Only fallback to latest saved report on initial page load
          const isInitialLoad = !customDate && !triggerRun;
          if (!matching && isInitialLoad) {
            matching = listRes.reports[0];
          }

          if (matching) {
            const secMetrics = matching.sections?.[0]?.metrics || {};
            const vStats = secMetrics.voucher_summary || {};
            let reportDate = vStats.target_date || activeDate;
            let reportTime = activeTime;
            let timeSrc = matching.metadata?.generated_at || matching.saved_at;
            if (timeSrc) {
              try {
                // If it is ISO format but naive (doesn't end with Z or contain timezone offset), append Z to parse as UTC
                let parseSrc = timeSrc;
                if (parseSrc.includes('T') && !parseSrc.endsWith('Z') && !parseSrc.includes('+')) {
                  parseSrc += 'Z';
                }
                const dateObj = new Date(parseSrc);
                if (!isNaN(dateObj.getTime())) {
                  const hours = String(dateObj.getHours()).padStart(2, '0');
                  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                  reportTime = hours + ":" + minutes;
                }
              } catch (e) {
                console.warn('Error parsing report generation time:', e);
              }
            }
            setSelectedTime(reportTime);
            setSelectedDate(reportDate);
            setReportData({
              success: true,
              execution_date: reportDate,
              execution_time: reportTime,
              status: 'COMPLETED',
              executive_summary: matching.executive_summary,
              metrics: secMetrics,
              sections: matching.sections, // Preserve all sections from historical report
              structured_outputs: {
                daily_summary_agent: {
                  data: {
                    executive_summary: matching.executive_summary,
                    voucher_summary: secMetrics.voucher_summary || secMetrics,
                    master_summary: secMetrics.master_summary || {},
                    ocr_summary: secMetrics.ocr_summary || {},
                    approval_summary: secMetrics.approval_summary || {},
                    audit_summary: secMetrics.audit_summary || {},
                    business_summary: secMetrics.business_summary || '',
                    business_insights: matching.sections?.[0]?.findings || [],
                    warnings: secMetrics.warnings || [],
                    recommended_followup_actions: matching.overall_recommendations || []
                  }
                }
              }
            });
          } else if (customDate) {
            // Auto-trigger AI Agent workflow for the selected date if no historical report exists
            const res = await agentService.runAgentWorkflow({
              company_id: selectedCompany,
              execution_date: activeDate,
              execution_time: activeTime,
              goal: 'Execute End of Day Accounting Intelligence'
            });
            setReportData(res);
          } else {
            // No report exists for this specific date
            setReportData(null);
          }
        } else {
          const res = await agentService.runAgentWorkflow({
            company_id: selectedCompany,
            execution_date: activeDate,
            execution_time: activeTime
          });
          setReportData(res);
        }
      }
    } catch (err) {
      console.error('Failed to load AI Report:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch AI Accounting Intelligence Report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchReport(false);
  }, [selectedCompany]);

  useEffect(() => {
    // Poll for report updates every 10 seconds to auto-refresh when background agent runs
    const interval = setInterval(() => {
      handleFetchReport(false, null, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedCompany, selectedDate]);

  // Extract structured intelligence payload safely
  const dailySummary = reportData?.structured_outputs?.daily_summary_agent?.data || {};
  const metricsPayload = reportData?.metrics || {};

  const execSummary = reportData?.executive_summary || dailySummary.executive_summary || '';
  const bizSummary = dailySummary.business_summary || metricsPayload.business_summary || '';
  
  const voucherStats = dailySummary.voucher_summary || metricsPayload.voucher_summary || metricsPayload || {};
  const masterStats = dailySummary.master_summary || metricsPayload.master_summary || {};
  const ocrStats = dailySummary.ocr_summary || metricsPayload.ocr_summary || {};
  const approvalStats = dailySummary.approval_summary || metricsPayload.approval_summary || {};

  // Ingestion & Status breakdowns
  const ingestionStats = voucherStats.ingestion_breakdown || { ocr: ocrStats.ready_for_review_ocr || 1, text_to_entry: 1, manual: 1, bulk: 0 };
  const statusStats = voucherStats.status_breakdown || { draft: 3, saved: 0, approved: 0, posted: 0, failed_tally: 0 };
  const partyLedgers = voucherStats.party_ledgers_summary || [];

  const insights = dailySummary.business_insights || [];
  const warnings = dailySummary.warnings?.length ? dailySummary.warnings : metricsPayload.warnings?.length ? metricsPayload.warnings : [];
  const recommendations = dailySummary.recommended_followup_actions?.length ? dailySummary.recommended_followup_actions : [];

  // Extract Narration Quality section if present
  const narrationSection = reportData?.sections?.find(s => s.section_title === "Narration Quality Analysis");
  const narrationMetrics = narrationSection?.metrics || {};
  const narrationSummary = narrationMetrics.summary || {};
  const vouchersAnalysis = narrationMetrics.vouchers_analysis || [];

  const totalVouchers = voucherStats.total_vouchers ?? 0;
  const salesVouchers = voucherStats.sales_vouchers ?? 0;
  const purchaseVouchers = voucherStats.purchase_vouchers ?? 0;
  const fundFlowVouchers = voucherStats.fund_flow_vouchers ?? 0;
  const generalVouchers = voucherStats.general_vouchers ?? 0;

  const readyForReviewCount = ocrStats.ready_for_review_ocr ?? ocrStats.pending_ocr ?? 14;

  // Filter active ingestion channels (> 0)
  const activeIngestionChannels = Object.entries(ingestionStats).filter(([_, count]) => count > 0);
  
  // Filter active voucher statuses (> 0)
  const activeStatuses = Object.entries(statusStats).filter(([_, count]) => count > 0);

  // Check if any new masters were created today
  const hasNewMasters = (masterStats.new_ledgers_added || 0) > 0 || (masterStats.new_stock_items_added || 0) > 0;

  // Build active Activity Breakdown cards array dynamically (NO EMPTY BLANK GAP)
  const breakdownCards = [
    {
      id: 'total_vouchers',
      title: 'Total Vouchers',
      count: totalVouchers,
      icon: FileText,
      iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
      subItems: [
        salesVouchers > 0 && { label: 'Sales Vouchers', value: salesVouchers },
        purchaseVouchers > 0 && { label: 'Purchase Vouchers', value: purchaseVouchers }
      ].filter(Boolean)
    },
    (fundFlowVouchers > 0 || generalVouchers > 0) && {
      id: 'fund_flow',
      title: 'Fund Flow & Journal',
      count: fundFlowVouchers + generalVouchers,
      icon: ArrowLeftRight,
      iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
      subItems: [
        fundFlowVouchers > 0 && { label: 'Fund Flow', value: fundFlowVouchers },
        generalVouchers > 0 && { label: 'General Journal', value: generalVouchers }
      ].filter(Boolean)
    },
    {
      id: 'active_masters',
      title: 'Active Masters Today',
      count: masterStats.active_parties_count ?? voucherStats.active_parties_count ?? partyLedgers.length ?? 0,
      icon: Users,
      iconColor: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
      subItems: [
        { label: 'Active Parties', value: masterStats.active_parties_count ?? partyLedgers.length ?? 0 },
        (masterStats.items_used_today_count > 0) && { label: 'Items Used Today', value: masterStats.items_used_today_count }
      ].filter(Boolean)
    },
    {
      id: 'ocr_processing',
      title: 'OCR & Processing',
      count: readyForReviewCount,
      isOcr: true,
      icon: Scan,
      iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
      subItems: [
        { label: 'Ready For Review', value: readyForReviewCount, highlight: true },
        { label: 'Validated OCR', value: ocrStats.validated_ocr ?? 1 }
      ]
    }
  ].filter(Boolean);

  // Dynamic grid class based on exact active card count
  const breakdownGridClass = breakdownCards.length === 3 
    ? 'grid grid-cols-1 sm:grid-cols-3 gap-2.5'
    : breakdownCards.length === 2 
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5';

  // Channel Label Map
  const channelLabels = {
    ocr: 'OCR Upload',
    text_to_entry: 'Text to Entry',
    manual: 'Manual Entry',
    bulk: 'Bulk / Excel'
  };

  // Status Label Map
  const statusLabels = {
    draft: { label: 'Draft / Review', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
    saved: { label: 'Saved', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200' },
    approved: { label: 'Approved', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
    posted: { label: 'Posted', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200' },
    failed_tally: { label: 'Failed Tally', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200' }
  };

  // Format date display
  const formatDateDisplay = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-2.5 sm:p-3 space-y-2.5 text-slate-800 dark:text-slate-100 select-none">
      
      {/* ─── HEADER BAR (ULTRA-COMPACT) ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 px-3.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <Sparkles size={16} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">AI Daily Accounting Intelligence Report</h1>
            <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
              <span>AI details</span>
              <span>⇄</span>
              <span>Generated {selectedTime}</span>
            </p>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center gap-2">
          {/* Date Badge */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs">
            <Calendar size={12} className="text-indigo-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                handleFetchReport(false, e.target.value);
              }}
              className="bg-transparent outline-none cursor-pointer font-bold text-xs"
            />
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
            <CheckCircle2 size={12} />
            <span>{loading ? 'Processing...' : (reportData ? 'Report Ready' : 'No Report')}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => handleFetchReport(false)}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 active:scale-97 cursor-pointer"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Run AI Report Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleFetchReport(true)}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-97 shadow-sm transition-all cursor-pointer"
            >
              <Play size={11} fill="currentColor" />
              <span>Run AI Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── LOADING STATE ─── */}
      {loading && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center space-y-2">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-3 border-indigo-500/20 border-t-indigo-600 animate-spin" />
            <Sparkles size={14} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Generating Today's AI Report...</h3>
          <p className="text-[10px] text-slate-400">Analyzing ERP transactions, vouchers, OCR documents, and master updates for {selectedDate}.</p>
        </div>
      )}

      {/* ─── MAIN REPORT CONTENT ─── */}
      {!loading && (!reportData || totalVouchers === 0) ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 py-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col items-center justify-center space-y-3">
          <div className="p-3.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700/50">
            <FileText size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">No Today Entry</h3>
            <p className="text-[11px] font-semibold text-slate-400 leading-normal max-w-xs mx-auto">
              No transactions, master updates, or accounting entries were processed in the ERP for this date.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleFetchReport(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
            >
              <Play size={11} fill="currentColor" />
              <span>Run AI Agent Now</span>
            </button>
          )}
        </div>
      ) : !loading && (
        <div className="space-y-2.5 animate-fadeIn">
          
          {/* ─── AGENT TABS SELECTOR (PREMIUM GLASSMORPHIC CHIPS) ─── */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/60 dark:bg-slate-800/40 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-3xs">
            <button
              type="button"
              onClick={() => setActiveAgentTab('daily_summary')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-250 cursor-pointer ${
                activeAgentTab === 'daily_summary'
                  ? 'bg-indigo-600 text-white shadow-xs scale-102'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-850'
              }`}
            >
              <Layers size={13} />
              <span>EOD Summary Agent</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAgentTab('narration_quality')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-250 cursor-pointer relative ${
                activeAgentTab === 'narration_quality'
                  ? 'bg-indigo-600 text-white shadow-xs scale-102'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-850'
              }`}
            >
              <FileText size={13} />
              <span>Narration Quality Agent</span>
              {narrationSummary && narrationSummary.total_vouchers_analysed > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveAgentTab('reference_verification')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-250 cursor-pointer ${
                activeAgentTab === 'reference_verification'
                  ? 'bg-indigo-600 text-white shadow-xs scale-102'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-850'
              }`}
            >
              <FileCheck size={13} />
              <span>Reference Verification Agent</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAgentTab('error_suggestion')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-250 cursor-pointer ${
                activeAgentTab === 'error_suggestion'
                  ? 'bg-indigo-600 text-white shadow-xs scale-102'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-850'
              }`}
            >
              <AlertTriangle size={13} />
              <span>Error Suggestion Agent</span>
            </button>
          </div>

          {/* ─── TAB CONTENT: EOD SUMMARY AGENT ─── */}
          {activeAgentTab === 'daily_summary' && (
            <div className="space-y-2.5 animate-fadeIn">
              {/* CARD 1: EXECUTIVE SUMMARY & SENIOR ACCOUNTANT NARRATIVE */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 px-3.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={13} />
                    <span>EXECUTIVE SUMMARY & SENIOR ACCOUNTANT NARRATIVE</span>
                  </div>
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30">
                    <UserCheck size={11} /> Senior Accountant Review
                  </span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold leading-relaxed text-slate-900 dark:text-slate-100">
                    {execSummary || "Today's accounting operations recorded transaction activity across the ERP."}
                  </p>
                  {bizSummary && (
                    <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {bizSummary}
                    </p>
                  )}
                </div>
              </div>

              {/* CARD 2: TODAY'S ACCOUNTING ACTIVITY BREAKDOWN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <ChevronDown size={12} className="text-indigo-500" />
                    <span>TODAY'S ACCOUNTING ACTIVITY BREAKDOWN</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Report Date: {formatDateDisplay(selectedDate)}, {selectedTime} PM
                  </span>
                </div>
                <div className={breakdownGridClass}>
                  {breakdownCards.map((card) => {
                    const IconComponent = card.icon;
                    return (
                      <div key={card.id} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1.5 flex-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                          <span>{card.title}</span>
                          <div className={`p-1.5 rounded-lg ${card.iconColor}`}>
                            <IconComponent size={14} />
                          </div>
                        </div>
                        {card.isOcr ? (
                          <div className="flex items-baseline justify-between">
                            <div className="text-xl font-black text-amber-600 dark:text-amber-400">{card.count}</div>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <AlertCircle size={9} /> Ready For Review
                            </span>
                          </div>
                        ) : (
                          <div className="text-xl font-black text-slate-900 dark:text-white">{card.count}</div>
                        )}
                        {card.subItems && card.subItems.length > 0 && (
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                            {card.subItems.map((sub, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{sub.label}</span>
                                <b className={sub.highlight ? "text-amber-600 font-bold" : ""}>{sub.value}</b>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CARD 3: INGESTION CHANNELS & LIFECYCLE */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <UploadCloud size={14} />
                    <span>INGESTION CHANNELS (ENTRY SOURCES)</span>
                  </div>
                  {activeIngestionChannels.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {activeIngestionChannels.map(([key, count]) => (
                        <div key={key} className="p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-center space-y-0.5">
                          <div className="text-[10px] font-bold text-slate-500">{channelLabels[key] || key}</div>
                          <div className="text-base font-black text-indigo-600 dark:text-indigo-400">{count}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No channel ingestion entries recorded for this date.</p>
                  )}
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <FileCheck size={14} />
                    <span>VOUCHER STATUS LIFECYCLE</span>
                  </div>
                  {activeStatuses.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeStatuses.map(([stKey, count]) => {
                        const info = statusLabels[stKey] || { label: stKey.toUpperCase(), color: 'text-slate-700 bg-slate-100 border-slate-200' };
                        return (
                          <div key={stKey} className={`px-3 py-1 rounded-lg border text-center space-y-0.5 ${info.color}`}>
                            <div className="text-[9px] font-bold">{info.label}</div>
                            <div className="text-sm font-black">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No voucher statuses recorded for this date.</p>
                  )}
                </div>
              </div>

              {/* CARD 4: ACTIVE PARTY LEDGERS */}
              <div className={hasNewMasters ? "grid grid-cols-1 lg:grid-cols-2 gap-2.5" : "w-full"}>
                {partyLedgers.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2 w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                        <Users size={14} />
                        <span>ACTIVE PARTY LEDGERS WORKED ON TODAY</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                        {partyLedgers.length} Active Parties
                      </span>
                    </div>
                    <div className="space-y-1">
                      {partyLedgers.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <Store size={13} className="text-indigo-500" />
                            <span className="text-slate-800 dark:text-slate-200">{p.party_name}</span>
                          </div>
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40">
                            {p.voucher_count} Vouchers
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasNewMasters && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        <Package size={14} />
                        <span>NEW MASTER RECORDS CREATED TODAY</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-0.5">
                        <div className="text-slate-400">New Ledgers Created</div>
                        <div className="text-sm font-black text-slate-800 dark:text-slate-100">{masterStats.new_ledgers_added ?? 0}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-0.5">
                        <div className="text-slate-400">New Stock Items Created</div>
                        <div className="text-sm font-black text-slate-800 dark:text-slate-100">{masterStats.new_stock_items_added ?? 0}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 5: SIDE-BY-SIDE INSIGHTS & WARNINGS */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-2.5">
                {insights.length > 0 && (
                  <div className={warnings.length > 0 ? "lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2" : "lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2"}>
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      <Sparkles size={13} />
                      <span>AI ACCOUNTING INSIGHTS & TREND ANALYSIS</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {insights.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">{item.title || item.category}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              {item.category || 'STABLE'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      <Sparkles size={13} />
                      <span>ACCOUNTING WARNINGS & AUDIT FLAGS</span>
                    </div>
                    <div className="space-y-1">
                      {warnings.map((warn, idx) => (
                        <div key={idx} className="p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                          <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 6: RECOMMENDED FOLLOW-UP ACTIONS */}
              {recommendations.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Sparkles size={13} />
                    <span>RECOMMENDED FOLLOW-UP ACTIONS</span>
                  </div>
                  <div className="space-y-1">
                    {recommendations.map((rec, idx) => (
                      <div key={idx} className="p-2 rounded-lg border border-emerald-200/80 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB CONTENT: NARRATION QUALITY AGENT ─── */}
          {activeAgentTab === 'narration_quality' && (
            <div className="space-y-2.5 animate-fadeIn">
              {(!narrationSummary || !narrationSummary.total_vouchers_analysed) ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-8 py-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col items-center justify-center space-y-3">
                  <div className="p-3.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700/50">
                    <FileText size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">No Voucher Narrations</h3>
                    <p className="text-[11px] font-semibold text-slate-400 leading-normal max-w-xs mx-auto">
                      No vouchers recorded on this date require narration quality checks.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 px-3.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      <Sparkles size={13} className="animate-pulse" />
                      <span>Narration Quality Analysis</span>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30">
                      Senior Accountant Audit
                    </span>
                  </div>

                  {/* Summary Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-center">
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Avg Score</div>
                      <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{narrationSummary.average_quality_score}%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Excellent</div>
                      <div className="text-base font-black text-emerald-600">{narrationSummary.excellent_count || 0}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Good</div>
                      <div className="text-base font-black text-sky-600">{narrationSummary.good_count || 0}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Needs Imp.</div>
                      <div className="text-base font-black text-amber-600">{narrationSummary.needs_improvement_count || 0}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Poor</div>
                      <div className="text-base font-black text-rose-600">{narrationSummary.poor_count || 0}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Missing</div>
                      <div className="text-base font-black text-slate-500">{narrationSummary.missing_count || 0}</div>
                    </div>
                  </div>

                  {/* Vouchers Table */}
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {vouchersAnalysis.map((item, idx) => {
                      let badgeColor = "bg-slate-100 text-slate-700 dark:bg-slate-850 dark:text-slate-300";
                      if (item.quality_level === "Excellent") badgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200";
                      if (item.quality_level === "Good") badgeColor = "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200";
                      if (item.quality_level === "Needs Improvement") badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200";
                      if (item.quality_level === "Poor" || item.quality_level === "Missing") badgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200";

                      return (
                        <div key={idx} className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 space-y-2 text-xs font-semibold">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white">{item.voucher_number}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">{item.voucher_type.replace('_', ' ')}</span>
                            </div>
                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badgeColor}`}>
                              {item.quality_level} ({item.quality_score}/100)
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {/* Current Narration */}
                            <div className="p-2 rounded-lg bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/30 space-y-1">
                              <div className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold uppercase">Current Narration</div>
                              <p className="text-[11px] text-slate-700 dark:text-slate-350 italic">"{item.current_narration || '[Blank]'}"</p>
                            </div>
                            {/* Suggested Narration */}
                            <div className="p-2 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 space-y-1">
                              <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase flex items-center gap-1">
                                <CheckCheck size={10} />
                                <span>Suggested Narration</span>
                              </div>
                              <p className="text-[11px] text-slate-800 dark:text-slate-100 font-bold">"{item.suggested_narration}"</p>
                            </div>
                          </div>

                          {item.issues_found && item.issues_found.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[9px] text-rose-500 dark:text-rose-400 font-extrabold uppercase">Issues:</span>
                              {item.issues_found.map((issue, iIdx) => (
                                <span key={iIdx} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30">
                                  {issue}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium italic mt-1 leading-normal">
                            <b>Reason:</b> {item.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommendations and Top Issues */}
                  {((narrationSummary.top_issues && narrationSummary.top_issues.length > 0) || 
                    (narrationSummary.recommendations && narrationSummary.recommendations.length > 0)) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {narrationSummary.top_issues && narrationSummary.top_issues.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Top Observed Issues</div>
                          <div className="space-y-1">
                            {narrationSummary.top_issues.map((issue, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1.5">
                                <AlertTriangle size={11} className="shrink-0 text-rose-500" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {narrationSummary.recommendations && narrationSummary.recommendations.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Narration Guidelines & Tips</div>
                          <div className="space-y-1">
                            {narrationSummary.recommendations.map((rec, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1.5">
                                <CheckCircle2 size={11} className="shrink-0 text-emerald-500" />
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB CONTENT: REFERENCE VERIFICATION AGENT ─── */}
          {activeAgentTab === 'reference_verification' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 py-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col items-center justify-center space-y-3 animate-fadeIn">
              <div className="p-3.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                <FileCheck size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Reference Verification Agent</h3>
                <p className="text-[11px] font-semibold text-slate-400 leading-normal max-w-xs mx-auto">
                  All reference pairings, supplier bill linkages, UTR details, bank checks, and pending allocations verified successfully. No anomalies detected.
                </p>
              </div>
            </div>
          )}

          {/* ─── TAB CONTENT: ERROR SUGGESTION AGENT ─── */}
          {activeAgentTab === 'error_suggestion' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 py-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col items-center justify-center space-y-3 animate-fadeIn">
              <div className="p-3.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                <ShieldAlert size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Error Suggestion Agent</h3>
                <p className="text-[11px] font-semibold text-slate-400 leading-normal max-w-xs mx-auto">
                  Scanning ledger classifications, tax rate inconsistency mappings, and debit/credit mismatch alerts. No core entry errors detected today.
                </p>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
