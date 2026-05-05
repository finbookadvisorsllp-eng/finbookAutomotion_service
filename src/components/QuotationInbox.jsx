import React from 'react';
import { 
  Plus, 
  Download, 
  RefreshCw, 
  Trash2, 
  Settings, 
  Search, 
  HelpCircle, 
  Bell, 
  User,
  Info,
  Copy,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpDown
} from 'lucide-react';

const QuotationInbox = () => {
  return (
    <div className="main-content">
      <header className="header">
        <div className="header-left">
          <h1 className="page-title">Quotation Inbox</h1>
          <div className="action-buttons">
            <button className="icon-btn add" title="Add"><Plus size={18} /></button>
            <button className="icon-btn" title="Download"><Download size={18} /></button>
            <button className="icon-btn" title="Sync"><RefreshCw size={18} /></button>
            <button className="icon-btn delete" title="Delete"><Trash2 size={18} /></button>
            <button className="icon-btn" title="Settings"><Settings size={18} /></button>
          </div>
        </div>

        <div className="header-center">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input type="text" className="search-input" placeholder="Search Here" />
          </div>
        </div>

        <div className="header-right">
          <button className="icon-btn"><HelpCircle size={18} /></button>
          <button className="icon-btn"><Bell size={18} /></button>
          <button className="icon-btn"><User size={18} /></button>
        </div>
      </header>

      <div className="content-area">
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" /></th>
                <th>Sr No.</th>
                <th>Quotation Number <ArrowUpDown size={12} style={{ marginLeft: 4, display: 'inline' }} /></th>
                <th>Quotation Date <ArrowUpDown size={12} style={{ marginLeft: 4, display: 'inline' }} /></th>
                <th>Party Name <ArrowUpDown size={12} style={{ marginLeft: 4, display: 'inline' }} /></th>
                <th>Base Total <ArrowUpDown size={12} style={{ marginLeft: 4, display: 'inline' }} /></th>
                <th>Total <ArrowUpDown size={12} style={{ marginLeft: 4, display: 'inline' }} /></th>
                <th>Status <ArrowUpDown size={12} style={{ marginLeft: 4, display: 'inline' }} /></th>
                <th>Action</th>
                <th>Chat</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="checkbox" /></td>
                <td>1</td>
                <td style={{ color: 'var(--primary)', fontWeight: '500' }}>1</td>
                <td>29-04-2026</td>
                <td>aman</td>
                <td>120.00</td>
                <td>120.00</td>
                <td>
                  <span className="status-badge downloaded">Downloaded</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="action-circle"><Info size={14} /></button>
                    <button className="action-circle" style={{ color: '#10b981' }}><Copy size={14} /></button>
                    <button className="action-circle" style={{ color: '#5e5ce6' }}><RefreshCw size={14} /></button>
                    <button className="action-circle" style={{ color: '#0369a1' }}><Eye size={14} /></button>
                  </div>
                </td>
                <td>
                  <button className="action-circle"><MessageSquare size={14} /></button>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div className="pagination">
            <div className="pagination-info">1 - 1 of 1 &nbsp; <ChevronLeft size={16} style={{ verticalAlign: 'middle', opacity: 0.5 }} /> &nbsp; <ChevronRight size={16} style={{ verticalAlign: 'middle', opacity: 0.5 }} /></div>
            <div className="pagination-controls">
              <select className="rows-select">
                <option>10</option>
                <option>20</option>
                <option>50</option>
              </select>
              <ChevronDown size={14} style={{ marginLeft: -25, pointerEvents: 'none', color: '#64748b' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationInbox;
