import React from 'react';
import {
  Building2, BarChart3, CalendarDays,
  ChevronLeft, ChevronRight, X, UserCheck, LogOut, Award, FileText, KeyRound
} from 'lucide-react';

export default function BialSidebar({
  activeTab,
  onSelectTab,
  onOpenYearlySummary,
  onOpenCertificate,
  onOpenPasswordModal,
  year,
  setYear,
  financialYears = [],
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onLogout,
  bialName = 'Selected Bial'
}) {
  const navTabs = [
    {
      id: 'main',
      label: 'Pathian Ram ziahna',
      shortLabel: 'Pathian Ram ziahna',
      icon: Building2,
      desc: 'Member tithes & entries'
    },
    {
      id: 'analytics',
      label: 'Stats & Analytics',
      shortLabel: 'Analytics',
      icon: BarChart3,
      desc: 'Charts & monthly trends'
    }
  ];

  const bialTools = [
    {
      id: 'overall',
      label: 'Overall Summary',
      shortLabel: 'Overall',
      icon: CalendarDays,
      color: 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200',
      action: onOpenYearlySummary,
      tooltip: 'View Bial yearly totals & monthly breakdown'
    },
    ...(onOpenPasswordModal ? [{
      id: 'password',
      label: 'Change Password',
      shortLabel: 'Credentials',
      icon: KeyRound,
      color: 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200',
      action: onOpenPasswordModal,
      tooltip: 'Update login password / credentials'
    }] : [])
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
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-heading font-bold text-sm text-slate-900 truncate">
                    {bialName}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    Bial Control Menu
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto p-1.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
            )}

            {isDrawer ? (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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

          {/* Section 1: Navigation Tabs */}
          <div className="px-2 space-y-1">
            {showFull && (
              <span className="px-2 text-[11px] font-semibold text-slate-500 block mb-1">
                Navigation
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
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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

          {/* Section 2: Bial Actions / Tools (Overall, Export) */}
          <div className="px-2 space-y-1 pt-2 border-t border-slate-100">
            {showFull && (
              <span className="px-2 text-[11px] font-semibold text-slate-500 block mb-1">
                Bial Features
              </span>
            )}
            {bialTools.map(tool => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.action)}
                  title={tool.tooltip || tool.label}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors border cursor-pointer ${tool.color} ${
                    !showFull ? 'justify-center px-0' : ''
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                  {showFull && (
                    <span className="truncate text-left flex-1 font-medium">
                      {tool.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Bottom Controls (Financial Year & Logout) */}
        <div className="p-2 space-y-2 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          {showFull ? (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-500 px-1">
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
              title="Logout from Bial View"
            >
              <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
              {showFull && <span>Logout</span>}
            </button>
          )}

          {showFull && (
            <div className="px-1 pt-0.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Pathian Ram</span>
              <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                Bial User
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent / Collapsible Left Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="sticky top-20 glass-panel rounded-2xl p-1.5 border border-slate-200/90 shadow-xs min-h-[520px]">
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
