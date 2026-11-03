import React from 'react';
import {
  Building2, Eye, BarChart3, RefreshCw, ArrowRightLeft,
  FileText, FileSpreadsheet, Calendar, KeyRound, CalendarDays, ChevronLeft,
  ChevronRight, X, Shield, Sparkles, FolderArchive, LogOut, Award, SlidersHorizontal
} from 'lucide-react';

export default function AdminSidebar({
  activeTab,
  onSelectTab,
  onOpenTransfer,
  onOpenConsolidated,
  onOpenReportForm,
  onOpenMatrix,
  onOpenCredentials,
  onOpenYears,
  onOpenColumns,
  year,
  setYear,
  financialYears = [],
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onLogout
}) {
  const navTabs = [
    {
      id: 'bials',
      label: 'Main Overview',
      shortLabel: 'Main',
      icon: Building2,
      desc: 'Bials & summary'
    },
    {
      id: 'inspector',
      label: 'Bial Inspector',
      shortLabel: 'Inspector',
      icon: Eye,
      desc: 'Member tithes ledger'
    },
    {
      id: 'analytics',
      label: 'Stats & Analytics',
      shortLabel: 'Stats',
      icon: BarChart3,
      desc: 'Charts & allocation'
    },
    {
      id: 'backups',
      label: 'Backup & Restore',
      shortLabel: 'Backup',
      icon: RefreshCw,
      desc: 'Database snapshots'
    }
  ];

  const adminTools = [
    {
      id: 'transfer',
      label: 'Member Transfer',
      shortLabel: 'Transfer',
      icon: ArrowRightLeft,
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200',
      action: onOpenTransfer,
      tooltip: 'Transfer member between bials'
    },
    {
      id: 'consolidated',
      label: 'Consolidated Report',
      shortLabel: 'Consolidated',
      icon: FileSpreadsheet,
      color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
      action: onOpenConsolidated,
      tooltip: 'Export consolidated report & ledger'
    },
    {
      id: 'report_form',
      label: 'Report Form',
      shortLabel: 'Report Form',
      icon: FileText,
      color: 'text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200',
      action: onOpenReportForm,
      tooltip: 'Generate certificate & letterhead report form'
    },
    {
      id: 'matrix',
      label: 'Month Matrix',
      shortLabel: 'Matrix',
      icon: Calendar,
      color: 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200',
      action: onOpenMatrix,
      tooltip: 'Lock & unlock month entries'
    },
    {
      id: 'credentials',
      label: 'Bial Credentials',
      shortLabel: 'Credentials',
      icon: KeyRound,
      color: 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200',
      action: onOpenCredentials,
      tooltip: 'Manage bial logins & passwords'
    },
    {
      id: 'years',
      label: 'Financial Years',
      shortLabel: 'Years',
      icon: CalendarDays,
      color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
      action: onOpenYears,
      tooltip: 'Manage financial years & active FY'
    },
    {
      id: 'columns',
      label: 'Tithe Headers & Columns',
      shortLabel: 'Headers',
      icon: SlidersHorizontal,
      color: 'text-teal-700 bg-teal-50 hover:bg-teal-100 border-teal-200',
      action: onOpenColumns,
      tooltip: 'Add, rename, edit or delete tithe columns'
    }
  ];

  const handleToolClick = (toolAction) => {
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
    toolAction();
  };

  const handleTabClick = (tabId) => {
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
    onSelectTab(tabId);
  };

  // --- RENDER SIDEBAR CONTENT ---
  const renderSidebarContent = (isDrawer = false) => {
    const showFull = isDrawer || !isCollapsed;

    return (
      <div className="h-full flex flex-col justify-between select-none">
        <div className="space-y-4">
          {/* Sidebar Top Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-slate-100">
            {showFull ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-xs shadow-indigo-600/20 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-900 truncate">
                    Admin Menu
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    Control & Navigation
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto p-1.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Shield className="w-4 h-4" />
              </div>
            )}

            {isDrawer ? (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Section 1: Navigation Views */}
          <div className="px-2 space-y-1">
            {showFull && (
              <span className="px-2 text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Views
              </span>
            )}
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  title={tab.label}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-transparent'
                  } ${!showFull ? 'justify-center px-0' : ''}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  {showFull && (
                    <div className="text-left min-w-0 flex-1">
                      <div className="leading-tight truncate">{tab.label}</div>
                    </div>
                  )}
                  {showFull && isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Section 2: Admin Tools (Transfer, Report, Matrix, Credentials, Years) */}
          <div className="px-2 space-y-1 pt-2 border-t border-slate-100">
            {showFull && (
              <span className="px-2 text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Admin Tools
              </span>
            )}
            {adminTools.map(tool => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.action)}
                  title={tool.tooltip || tool.label}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer hover:scale-[1.01] active:scale-[0.98] ${tool.color} ${
                    !showFull ? 'justify-center px-0' : ''
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {showFull && (
                    <span className="truncate text-left flex-1 font-bold">
                      {tool.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Bottom Controls (Financial Year Selector & App Info) */}
        <div className="p-2 space-y-2 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          {showFull ? (
            <div className="space-y-1.5">
              <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-500 px-1">
                Financial Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                title="Change active Financial Year"
              >
                {financialYears.map(y => (
                  <option key={y} value={y}>FY {y} ({y}-{y + 1})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-center py-1 font-mono font-bold text-[10px] text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-100" title={`Current FY: ${year}`}>
              '{String(year).slice(-2)}
            </div>
          )}
          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={() => {
                if (isMobileOpen && onCloseMobile) onCloseMobile();
                onLogout();
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-2xs ${
                !showFull ? 'justify-center px-0' : ''
              }`}
              title="Logout from Admin Dashboard"
            >
              <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
              {showFull && <span>Logout</span>}
            </button>
          )}

          {showFull && (
            <div className="px-1 pt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Pathian Ram</span>
              <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                Admin
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- STANDARD RESPONSIVE VIEW ---
  return (
    <>
      {/* Desktop Persistent / Collapsible Left Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="sticky top-20 glass-panel rounded-2xl p-1.5 border border-slate-200/90 shadow-xs min-h-[580px]">
          {renderSidebarContent(false)}
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-white z-50 shadow-2xl border-r border-slate-200 transition-transform duration-300 ease-in-out p-2 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>
    </>
  );
}
