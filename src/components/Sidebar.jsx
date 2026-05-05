import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Settings2, 
  FileText, 
  Receipt, 
  BarChart3, 
  ShoppingCart, 
  Wallet, 
  Landmark, 
  ShieldCheck, 
  FolderOpen, 
  Boxes,
  ChevronDown,
  ChevronUp,
  Inbox
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [openMenus, setOpenMenus] = useState(['Quotation']);

  const toggleMenu = (menu) => {
    if (openMenus.includes(menu)) {
      setOpenMenus(openMenus.filter(m => m !== menu));
    } else {
      setOpenMenus([...openMenus, menu]);
    }
  };

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, hasSub: true },
    { name: 'Manage', icon: Settings2, hasSub: true },
    { 
      name: 'Quotation', 
      icon: FileText,
      hasSub: true,
      subItems: [
        { name: 'Quotation Inbox', icon: Inbox }
      ]
    },
    { name: 'Invoice', icon: Receipt, hasSub: true },
    { name: 'Sales', icon: BarChart3, hasSub: true },
    { name: 'Purchase/Expense', icon: ShoppingCart, hasSub: true },
    { name: 'Petty Cash', icon: Wallet, hasSub: true },
    { name: 'Bank', icon: Landmark, hasSub: true },
    { name: 'Role Management', icon: ShieldCheck, hasSub: true },
    { name: 'My Documents', icon: FolderOpen, hasSub: false },
    { name: 'Master Data', icon: Boxes, hasSub: true }
  ];

  return (
    <div className="sidebar">
      <div style={{ padding: '0 20px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, background: 'var(--primary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#fff' }}>
          <FileText size={18} style={{ margin: 'auto' }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>ERP PRO</span>
      </div>

      {menuItems.map((item) => (
        <div key={item.name} className="nav-group">
          <div 
            className={`nav-item ${activeTab === item.name || (item.subItems && item.subItems.some(s => s.name === activeTab)) ? 'active' : ''}`}
            onClick={() => item.hasSub ? toggleMenu(item.name) : setActiveTab(item.name)}
          >
            <item.icon className="icon" />
            <span>{item.name}</span>
            {item.hasSub && (
              openMenus.includes(item.name) ? <ChevronUp className="chevron" /> : <ChevronDown className="chevron" />
            )}
          </div>
          
          {item.subItems && openMenus.includes(item.name) && (
            <div className="sub-nav">
              {item.subItems.map(subItem => (
                <div 
                  key={subItem.name} 
                  className={`sub-item ${activeTab === subItem.name ? 'active' : ''}`}
                  onClick={() => setActiveTab(subItem.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <subItem.icon size={14} />
                  {subItem.name}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Sidebar;
