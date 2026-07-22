import React from 'react';
import { Cpu, Scan, Copy, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { toast } from 'sonner';

export const highlightText = (text, highlight) => {
  if (!highlight.trim()) return text;
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) => 
    regex.test(part) 
      ? <mark key={i} className="bg-yellow-250 dark:bg-yellow-800/60 text-slate-900 dark:text-white px-0.5 rounded">{part}</mark>
      : part
  );
};

export const OcrLoadingScreen = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-[#121212] p-8 select-none">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-100 dark:border-indigo-950 border-t-indigo-650 dark:border-t-indigo-400 animate-spin flex items-center justify-center">
        </div>
        <div className="flex flex-col gap-1.5 mt-2">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5 justify-center">
            <Cpu size={15} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <span>Running PaddleOCR Ingestion...</span>
          </span>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
            Converting pages and running text extraction on PaddleOCR backend. Please wait...
          </p>
        </div>
      </div>
    </div>
  );
};

export const OcrLeftPanel = ({
  previewDoc,
  ocrResult,
  ocrActivePage,
  setOcrActivePage,
  ocrZoom,
  setOcrZoom,
  renderPdfPreview,
  renderImagePreview
}) => {
  const ext = (previewDoc.name || '').split('.').pop().toLowerCase();
  const pageCount = ocrResult ? ocrResult.page_count : 1;

  const handlePrevPage = () => {
    if (ocrActivePage > 1) setOcrActivePage(prev => prev - 1);
  };

  const handleNextPage = () => {
    if (ocrActivePage < pageCount) setOcrActivePage(prev => prev + 1);
  };

  const handleZoomIn = () => {
    setOcrZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setOcrZoom(prev => Math.max(prev - 10, 50));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full min-w-0 bg-slate-50 dark:bg-[#121212]">
      {/* Left Panel Toolbar */}
      <div className="h-10 px-4 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 select-none">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Document Preview</span>
          <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
          <span className="text-[10.5px] font-semibold text-slate-650 dark:text-slate-400">
            Page {ocrActivePage} of {pageCount}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Page Navigation */}
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={ocrActivePage <= 1}
                className="w-6 h-6 rounded flex items-center justify-center border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-855 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={ocrActivePage >= pageCount}
                className="w-6 h-6 rounded flex items-center justify-center border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-855 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={ocrZoom <= 50}
              className="w-6 h-6 rounded flex items-center justify-center border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-300"
            >
              -
            </button>
            <span className="w-8 text-center">{ocrZoom}%</span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={ocrZoom >= 200}
              className="w-6 h-6 rounded flex items-center justify-center border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-300"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Document Viewer Frame */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-100/50 dark:bg-slate-950/40">
        <div 
          className="transition-transform duration-200 ease-out" 
          style={{ 
            transform: `scale(${ocrZoom / 100})`, 
            transformOrigin: 'center center',
          }}
        >
          {ext === 'pdf' ? (
            previewDoc.fileUrl ? (
              <iframe
                src={`${previewDoc.fileUrl}#page=${ocrActivePage}&toolbar=0&navpanes=0`}
                className="w-[210mm] h-[297mm] border border-slate-200 dark:border-slate-805 rounded bg-white shadow-md"
                title={previewDoc.name}
              />
            ) : (
              renderPdfPreview()
            )
          ) : (
            previewDoc.fileUrl ? (
              <img
                src={previewDoc.fileUrl}
                alt={previewDoc.name}
                className="max-w-[210mm] max-h-[297mm] object-contain rounded shadow-md border border-slate-200 dark:border-slate-805 bg-white"
              />
            ) : (
              renderImagePreview()
            )
          )}
        </div>
      </div>
    </div>
  );
};

export const OcrRightPanel = ({
  ocrResult,
  ocrActivePage,
  setOcrActivePage,
  ocrSearchQuery,
  setOcrSearchQuery
}) => {
  if (!ocrResult) return null;
  const activePageData = ocrResult.pages.find(p => p.page_number === ocrActivePage) || ocrResult.pages[0] || { text: '', confidence: 0 };
  const confVal = activePageData.confidence;
  const displayConf = confVal > 1 ? confVal : confVal * 100;
  
  const getHighlightedParagraphs = (text, highlight) => {
    if (!text) return <p className="text-slate-400 dark:text-slate-600 italic">No text extracted on this page.</p>;
    const paragraphs = text.split('\n');
    return paragraphs.map((para, pIdx) => {
      if (!para.trim()) return null;
      return (
        <p key={pIdx} className="mb-3 leading-relaxed text-slate-700 dark:text-slate-300 text-[11px] font-sans">
          {highlightText(para, highlight)}
        </p>
      );
    });
  };

  const handleCopyOcrText = () => {
    if (activePageData.text) {
      navigator.clipboard.writeText(activePageData.text);
      toast.success(`Copied Page ${ocrActivePage} text to clipboard!`);
    } else {
      toast.error("No text available to copy.");
    }
  };

  return (
    <div className="w-[380px] bg-white dark:bg-[#121212] flex flex-col overflow-hidden h-full shrink-0 border-l border-slate-200 dark:border-slate-800 font-sans">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Scan size={13} className="text-indigo-600 dark:text-indigo-400" />
            <span>OCR Text Output</span>
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">PaddleOCR Text Ingestion</span>
        </div>
        <button
          onClick={handleCopyOcrText}
          className="h-7 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 text-slate-650 dark:text-slate-400 border border-slate-250 dark:border-slate-750 cursor-pointer bg-white dark:bg-slate-900 text-[10px] font-bold"
          title="Copy OCR Text"
        >
          <Copy size={11} />
          <span>Copy</span>
        </button>
      </div>

      {/* Stats Panel */}
      <div className="p-4 bg-slate-50/20 dark:bg-slate-900/10 border-b border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 shrink-0">
        <div className="bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl shadow-3xs flex flex-col items-center justify-center text-center">
          <span className="text-[9px] font-bold text-slate-450 dark:text-slate-500 block uppercase tracking-wider">Confidence</span>
          <span className={`text-[12px] font-black block mt-0.5 ${
            displayConf >= 90 
              ? 'text-emerald-600 dark:text-emerald-400' 
              : displayConf >= 75 
              ? 'text-amber-605 dark:text-amber-400' 
              : 'text-red-500 dark:text-red-400'
          }`}>
            {displayConf.toFixed(1)}%
          </span>
        </div>
        <div className="bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl shadow-3xs flex flex-col items-center justify-center text-center">
          <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 block uppercase tracking-wider">Time Taken</span>
          <span className="text-[12px] font-black text-slate-800 dark:text-slate-200 block mt-0.5">
            {ocrResult.processing_time || '0.85'}s
          </span>
        </div>
        <div className="bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-805 p-2 rounded-xl shadow-3xs flex flex-col items-center justify-center text-center">
          <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 block uppercase tracking-wider">Total Pages</span>
          <span className="text-[12px] font-black text-slate-800 dark:text-slate-200 block mt-0.5">
            {ocrResult.page_count || 1}
          </span>
        </div>
      </div>

      {/* Page selector tabs */}
      {ocrResult.page_count > 1 && (
        <div className="px-4 py-2 bg-slate-50/40 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-805 flex gap-1.5 overflow-x-auto shrink-0 select-none">
          {ocrResult.pages.map(p => (
            <button
              key={p.page_number}
              onClick={() => setOcrActivePage(p.page_number)}
              className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all border shrink-0 ${
                ocrActivePage === p.page_number
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-150 dark:bg-indigo-950/45 dark:text-indigo-400 dark:border-indigo-900/60'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800'
              }`}
            >
              Page {p.page_number}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-3xs">
          <Search size={11} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search inside OCR text..."
            value={ocrSearchQuery}
            onChange={(e) => setOcrSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-850 dark:text-slate-250 outline-none border-none placeholder:text-slate-450 dark:placeholder:text-slate-650 font-medium"
          />
          {ocrSearchQuery && (
            <button
              onClick={() => setOcrSearchQuery('')}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-555 cursor-pointer border-none"
            >
              <X size={9} />
            </button>
          )}
        </div>
      </div>

      {/* Text Container */}
      <div className="flex-1 p-5 overflow-y-auto bg-slate-50/20 dark:bg-[#121212] select-text selection:bg-indigo-100 dark:selection:bg-indigo-900/40">
        {getHighlightedParagraphs(activePageData.text, ocrSearchQuery)}
      </div>
    </div>
  );
};
