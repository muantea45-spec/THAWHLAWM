import React, { useState, useEffect, useRef } from 'react';
import BialSidebar from '../components/BialSidebar';
import {
  Calendar, Lock, Unlock, UserPlus, Edit3, Trash2, Search,
  FileText, Save, CheckCircle, AlertTriangle,
  ArrowUp, ArrowDown, ArrowUpDown, Layers, Eye,
  ChevronDown, ChevronUp, LogOut, Building2, BarChart3, PieChart as PieChartIcon,
  RefreshCw, Menu, Award, Users
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

import { api, setAuthToken, setAuthUser } from '../utils/api';
import Modal from '../components/common/Modal';

const MemberModal = React.lazy(() => import('../components/MemberModal'));
const BialMemberEditModal = React.lazy(() => import('../components/BialMemberEditModal'));
const BialYearlySummaryModal = React.lazy(() => import('../components/BialYearlySummaryModal'));
const MemberHistoryModal = React.lazy(() => import('../components/MemberHistoryModal'));
const OfficialReportModal = React.lazy(() => import('../components/OfficialReportModal'));
const DigitalReceiptModal = React.lazy(() => import('../components/DigitalReceiptModal'));

import { FINANCIAL_MONTHS, MONTH_NAME_MAP, DEFAULT_TITHE_COLUMNS } from '../utils/constants';
import churchLogo from '../assets/church_logo.jpg';

const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7'];

export default function BialDashboard({ user, showToast }) {
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'analytics'
  const [financialYears, setFinancialYears] = useState([2024, 2025, 2026, 2027]);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(4); // Default to April (financial month 1)
  const [ledger, setLedger] = useState(null);
  const [titheColumns, setTitheColumns] = useState(DEFAULT_TITHE_COLUMNS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);
  const [memberFilter, setMemberFilter] = useState('all'); // 'all' | 'contributed' | 'unpaid'
  const [receiptMember, setReceiptMember] = useState(null);

  // Analytics Tab State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [compareMonthTarget, setCompareMonthTarget] = useState(5); // May
  const [compareMonthBase, setCompareMonthBase] = useState(4); // April
  const [summaryViewMode, setSummaryViewMode] = useState('month'); // 'month' | 'ytd'

  // Column Sorting State
  const [sortField, setSortField] = useState('sl_no');
  const [sortDirection, setSortDirection] = useState('asc');

  // Editable tithes draft state: { [member_id]: { pathian_ram, ramthar, tualchhung, building, total } }
  const [drafts, setDrafts] = useState({});

  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState(null);
  const [showMemberEditModal, setShowMemberEditModal] = useState(false);
  const [selectedMemberForEditModal, setSelectedMemberForEditModal] = useState(null);
  const [showYearlySummaryModal, setShowYearlySummaryModal] = useState(false);
  const [selectedMemberForHistory, setSelectedMemberForHistory] = useState(null);
  const [showMemberHistoryModal, setShowMemberHistoryModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Focus navigation matrix ref
  const inputRefs = useRef({});

  const targetBialId = user.role === 'ADMIN' ? (ledger?.bial_id || user.bial_id || 1) : user.bial_id;

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    window.location.href = '/';
  };

  const autoSelectUnlockedMonth = async (targetYear, bId) => {
    if (!bId) return;
    try {
      const summary = await api.getYearlySummary(bId, targetYear);
      if (summary && summary.monthlyBreakdown && Array.isArray(summary.monthlyBreakdown)) {
        const unlockedMonths = summary.monthlyBreakdown.filter(m => m.is_locked === 0 || m.is_locked === false);
        if (unlockedMonths.length > 0) {
          // Select the latest unlocked month in financial cycle
          const latestUnlocked = unlockedMonths[unlockedMonths.length - 1].month;
          setMonth(latestUnlocked);
        }
      }
    } catch (e) {
      console.error('Error auto-selecting unlocked month:', e);
    }
  };

  useEffect(() => {
    api.getFinancialYears()
      .then(res => {
        if (res) {
          const yearsList = Array.isArray(res) ? res : (res.years || []);
          const actYear = res.activeYear || (yearsList.length > 0 ? yearsList[yearsList.length - 1] : new Date().getFullYear());
          setFinancialYears(yearsList);
          setActiveYear(actYear);
          setYear(actYear);
          if (targetBialId) {
            autoSelectUnlockedMonth(actYear, targetBialId);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (targetBialId && year) {
      autoSelectUnlockedMonth(year, targetBialId);
    }
  }, [year, targetBialId]);

  useEffect(() => {
    const handleToggle = () => setIsMobileMenuOpen(prev => !prev);
    window.addEventListener('toggle-sidebar-menu', handleToggle);
    return () => window.removeEventListener('toggle-sidebar-menu', handleToggle);
  }, []);

  const loadLedger = async () => {
    try {
      setLoading(true);
      const res = await api.getTithes(targetBialId, year, month);
      setLedger(res);

      const cols = (res?.columns && Array.isArray(res.columns) && res.columns.length > 0) ? res.columns : DEFAULT_TITHE_COLUMNS;
      setTitheColumns(cols);

      const initialDrafts = {};
      (res.members || []).forEach(m => {
        const row = { total: m.total || 0 };
        cols.forEach(c => {
          row[c.field_key] = m[c.field_key] || '';
        });
        initialDrafts[m.member_id] = row;
      });
      setDrafts(initialDrafts);
    } catch (err) {
      showToast(err.message || 'Failed to load tithes ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!targetBialId) return;
    try {
      setAnalyticsLoading(true);
      const res = await api.getYearlySummary(targetBialId, year);
      setAnalyticsData(res);
      if (res?.columns && Array.isArray(res.columns) && res.columns.length > 0) {
        setTitheColumns(res.columns);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [year, month, targetBialId]);

  useEffect(() => {
    if (targetBialId && year) {
      loadAnalytics();
    }
  }, [year, targetBialId]);

  // Real-time synchronization for Tithe Columns and Headers across all Bial collector windows and devices
  useEffect(() => {
    let bc;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('tithe_columns_sync');
        bc.onmessage = (event) => {
          if (event?.data?.type === 'COLUMNS_UPDATED' || event?.data?.type === 'TITHE_UPDATED') {
            loadLedger();
            loadAnalytics();
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    const handleStorage = (e) => {
      if (e.key === 'tithe_columns_updated') {
        loadLedger();
        loadAnalytics();
      }
    };

    const handleCustomSync = () => {
      loadLedger();
      loadAnalytics();
    };

    const checkColumnsSignature = async () => {
      if (typeof document !== 'undefined' && (document.visibilityState !== 'visible' || document.hidden)) return;
      try {
        const res = await api.getColumns();
        const cols = Array.isArray(res) ? res : (res?.columns || []);
        if (cols && cols.length > 0) {
          setTitheColumns(prev => {
            const prevSig = (prev || []).map(c => `${c.id}_${c.name}_${c.code}_${c.color}_${c.display_order}`).join('|');
            const newSig = cols.map(c => `${c.id}_${c.name}_${c.code}_${c.color}_${c.display_order}`).join('|');
            if (prevSig !== newSig) {
              loadLedger();
              loadAnalytics();
              return cols;
            }
            return prev;
          });
        }
      } catch (e) {
        // Silent catch for background polling
      }
    };

    const pollInterval = setInterval(checkColumnsSignature, 300000); // 5 minutes fallback (real-time sync via BroadcastChannel)
    window.addEventListener('storage', handleStorage);
    window.addEventListener('tithe-columns-updated', handleCustomSync);
    window.addEventListener('focus', checkColumnsSignature);
    document.addEventListener('visibilitychange', checkColumnsSignature);

    return () => {
      if (bc) bc.close();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tithe-columns-updated', handleCustomSync);
      window.removeEventListener('focus', checkColumnsSignature);
      document.removeEventListener('visibilitychange', checkColumnsSignature);
    };
  }, [targetBialId, year, month]);

  // Column Sorting Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 font-bold" />
    );
  };

  // DIGIT-ONLY Validation & Live Sum Handler
  const handleNumericInputChange = (memberId, field, rawValue) => {
    if (ledger?.is_locked && user.role !== 'ADMIN') return;

    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const sanitizedVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;

    setDrafts(prev => {
      const current = prev[memberId] || { total: 0 };
      const updatedRow = { ...current, [field]: sanitizedVal };

      let total = 0;
      titheColumns.forEach(c => {
        total += parseFloat(updatedRow[c.field_key]) || 0;
      });
      updatedRow.total = total;

      return {
        ...prev,
        [memberId]: updatedRow
      };
    });
  };

  // Keyboard Shortcuts Navigation (Enter/Tab/Arrows)
  const handleKeyDown = (e, memberIndex, fieldName, membersList) => {
    const fields = titheColumns.map(c => c.field_key);
    const fieldIndex = fields.indexOf(fieldName);

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      let nextRow = memberIndex;
      let nextCol = fieldIndex + 1;

      if (nextCol >= fields.length) {
        nextCol = 0;
        nextRow = memberIndex + 1;
      }

      if (nextRow < membersList.length) {
        const nextMemberId = membersList[nextRow].member_id;
        const nextFieldName = fields[nextCol];
        const refKey = `${nextMemberId}-${nextFieldName}`;
        if (inputRefs.current[refKey]) {
          inputRefs.current[refKey].focus();
          inputRefs.current[refKey].select();
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (memberIndex + 1 < membersList.length) {
        e.preventDefault();
        const nextMemberId = membersList[memberIndex + 1].member_id;
        const refKey = `${nextMemberId}-${fieldName}`;
        if (inputRefs.current[refKey]) inputRefs.current[refKey].focus();
      }
    } else if (e.key === 'ArrowUp') {
      if (memberIndex - 1 >= 0) {
        e.preventDefault();
        const prevMemberId = membersList[memberIndex - 1].member_id;
        const refKey = `${prevMemberId}-${fieldName}`;
        if (inputRefs.current[refKey]) inputRefs.current[refKey].focus();
      }
    }
  };

  // Single Cell Autosave
  const handleSingleSave = async (memberId) => {
    if (ledger?.is_locked && user.role !== 'ADMIN') return;
    const row = drafts[memberId];
    if (!row) return;

    try {
      const payload = {
        bial_id: targetBialId,
        member_id: memberId,
        year,
        month,
        pathian_ram: parseFloat(row.pathian_ram) || 0,
        ramthar: parseFloat(row.ramthar) || 0,
        tualchhung: parseFloat(row.tualchhung) || 0,
        building: parseFloat(row.building) || 0
      };
      titheColumns.forEach(c => {
        payload[c.field_key] = parseFloat(row[c.field_key]) || 0;
      });
      await api.saveTithe(payload);
    } catch (err) {
      console.error('Autosave error:', err);
    }
  };

  const handleBulkSave = async () => {
    if (ledger?.is_locked && user.role !== 'ADMIN') {
      showToast('Month Locked by Admin. Cannot save changes.', 'error');
      return;
    }

    try {
      setSaving(true);
      const entries = Object.keys(drafts).map(memberId => {
        const row = drafts[memberId] || {};
        const entry = {
          member_id: parseInt(memberId),
          pathian_ram: parseFloat(row.pathian_ram) || 0,
          ramthar: parseFloat(row.ramthar) || 0,
          tualchhung: parseFloat(row.tualchhung) || 0,
          building: parseFloat(row.building) || 0
        };
        titheColumns.forEach(c => {
          entry[c.field_key] = parseFloat(row[c.field_key]) || 0;
        });
        return entry;
      });

      await api.bulkSaveTithes({
        bial_id: targetBialId,
        year,
        month,
        entries
      });

      showToast('All tithe changes saved successfully!', 'success');
      loadLedger();
    } catch (err) {
      showToast(err.message || 'Failed to save tithe records', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Member management (Bial users have full authority over their members)
  const handleSaveMember = async (memberData) => {
    try {
      if (memberData.id) {
        await api.updateMember(memberData.id, memberData);
        showToast('Member updated!', 'success');
      } else {
        await api.addMember({
          ...memberData,
          bial_id: targetBialId,
          year: year
        });
        showToast('Member added successfully!', 'success');
      }
      loadLedger();
    } catch (err) {
      showToast(err.message || 'Failed to save member', 'error');
    }
  };

  const handleDeleteMember = async (member) => {
    const memberId = member.member_id || member.id;
    if (!memberId) {
      showToast('Member ID not found', 'error');
      return;
    }
    if (!window.confirm(`Delete member "${member.name}" from this Bial?`)) return;
    try {
      await api.deleteMember(memberId);
      showToast(`Member "${member.name}" removed`, 'info');
      loadLedger();
    } catch (err) {
      showToast(err.message || 'Failed to delete member', 'error');
    }
  };

  // Filter & Sort Members List
  const rawMembers = ledger?.members || [];

  const isMemberPaid = (memberId) => {
    const d = drafts[memberId] || {};
    if ((d.total || 0) > 0) return true;
    return titheColumns.some(c => (parseFloat(d[c.field_key]) || 0) > 0);
  };

  const contributedCount = rawMembers.filter(m => isMemberPaid(m.member_id)).length;
  const unpaidCount = Math.max(0, rawMembers.length - contributedCount);

  let processedMembers = rawMembers.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(m.sl_no).includes(searchQuery);
    if (!matchesSearch) return false;

    const hasPaid = isMemberPaid(m.member_id);

    if (memberFilter === 'contributed') return hasPaid;
    if (memberFilter === 'unpaid') return !hasPaid;
    return true;
  });

  // Apply Sorting
  processedMembers.sort((a, b) => {
    let aVal, bVal;
    if (sortField === 'sl_no') {
      aVal = a.sl_no;
      bVal = b.sl_no;
    } else if (sortField === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else {
      const aDraft = drafts[a.member_id] || {};
      const bDraft = drafts[b.member_id] || {};
      if (sortField === 'total') {
        aVal = aDraft.total || 0;
        bVal = bDraft.total || 0;
      } else {
        aVal = parseFloat(aDraft[sortField]) || 0;
        bVal = parseFloat(bDraft[sortField]) || 0;
      }
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Footer Column Totals
  const footerColumnSums = {};
  titheColumns.forEach(c => { footerColumnSums[c.field_key] = 0; });
  let footerGrandTotal = 0;

  Object.values(drafts).forEach(d => {
    let rowTotal = 0;
    titheColumns.forEach(c => {
      const v = parseFloat(d[c.field_key]) || 0;
      footerColumnSums[c.field_key] += v;
      rowTotal += v;
    });
    footerGrandTotal += (d.total !== undefined ? d.total : rowTotal);
  });

  const isLocked = ledger?.is_locked === true;
  const rawBialName = user.role === 'ADMIN' ? (user.bial_name || ledger?.bial_name || 'Selected Bial') : (user.bial_name || ledger?.bial_name);
  
  // Extract assigned credential code (e.g., B1, B2, B3 reflecting admin assigned credentials)
  const rawCode = user.bial_code || ledger?.bial_code || (user.username ? user.username.toUpperCase() : '') || (targetBialId ? `B${targetBialId}` : '');
  let bialCodeTag = rawCode;
  if (bialCodeTag.startsWith('BIAL')) {
    bialCodeTag = 'B' + bialCodeTag.slice(4).trim();
  } else if (/^\d+$/.test(bialCodeTag)) {
    bialCodeTag = 'B' + bialCodeTag;
  }

  const bialName = (rawBialName && bialCodeTag && !rawBialName.toUpperCase().includes(bialCodeTag.toUpperCase()))
    ? `${rawBialName} (${bialCodeTag})`
    : (rawBialName || 'Selected Bial');

  // Prepare Analytics Charts Data
  const monthlyBreakdown = analyticsData?.monthlyBreakdown || [];
  const chartMonthlyTrends = monthlyBreakdown.map(m => {
    const mObj = FINANCIAL_MONTHS.find(f => f.id === m.month);
    const item = {
      month: mObj ? mObj.short : `M${m.month}`,
      fullMonth: mObj ? mObj.name : `Month ${m.month}`,
      total: m.total || 0,
      returned_members: m.returned_members || 0,
      total_system_members: m.total_system_members || 0
    };
    titheColumns.forEach(c => {
      item[c.field_key] = m[c.field_key] || 0;
    });
    return item;
  });

  const grandTotals = analyticsData?.grandTotals || {};
  const pieChartData = titheColumns.map(c => ({
    name: c.name,
    value: grandTotals[c.field_key] || grandTotals[`total_${c.field_key}`] || 0,
    color: c.color || '#6366f1'
  })).filter(d => d.value > 0);

  return (
    <div className="min-h-screen text-slate-900 p-2.5 sm:p-3.5 lg:p-4">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start gap-3 sm:gap-4 lg:gap-5">

        {/* Left Sidebar for Bial Views & Tools */}
        <BialSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenYearlySummary={() => setShowYearlySummaryModal(true)}
          onOpenCertificate={() => setShowCertificateModal(true)}
          year={year}
          setYear={setYear}
          financialYears={financialYears}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          isMobileOpen={isMobileMenuOpen}
          onOpenPasswordModal={() => setShowPasswordModal(true)}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
          bialName={bialName}
        />

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 w-full space-y-2.5 sm:space-y-3">

          {/* Active Bial Name Sub-Header Badge */}
          <div className="glass-panel px-3.5 py-2 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
                title="Open Navigation Menu"
              >
                <Menu className="w-3.5 h-3.5" />
                <span>Menu</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Bial: <span className="text-slate-900 font-bold">{bialName}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Lock Warning Banner if month is locked */}
          {isLocked && activeTab === 'main' && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Month Locked by Admin. Data entry and edits for this month are restricted.</span>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 rounded text-[10px] uppercase tracking-wide shrink-0 font-semibold text-amber-800">
                Read-Only
              </span>
            </div>
          )}

          {/* TAB 1: MAIN (PATHIAN RAM KHAWNNA LEDGER) */}
          {activeTab === 'main' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">

              {/* TOP MONTHLY / ALL MONTHS SUMMARY BOX */}
              {(() => {
                const getSummaryDisplay = () => {
                  const result = { total: 0 };
                  titheColumns.forEach(c => { result[c.field_key] = 0; });

                  if (summaryViewMode === 'all') {
                    titheColumns.forEach(c => {
                      result[c.field_key] = grandTotals[c.field_key] ?? grandTotals[`total_${c.field_key}`] ?? 0;
                    });
                    result.total = grandTotals.grand_total || 0;
                    return result;
                  }

                  const selectedMId = parseInt(summaryViewMode) || month;
                  if (selectedMId === month) {
                    titheColumns.forEach(c => {
                      result[c.field_key] = footerColumnSums[c.field_key] || 0;
                    });
                    result.total = footerGrandTotal;
                    return result;
                  }

                  const mObj = monthlyBreakdown.find(m => m.month === selectedMId) || {};
                  titheColumns.forEach(c => {
                    result[c.field_key] = mObj[c.field_key] || 0;
                  });
                  result.total = mObj.total || 0;
                  return result;
                };

                const disp = getSummaryDisplay();

                return (
                  <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Layers className="w-4 h-4 text-slate-600 shrink-0" />
                        <span className="font-heading font-semibold text-xs text-slate-800 uppercase tracking-wider">
                          Belhkhawm:
                        </span>
                      </div>

                      {/* Inline Month Selection Dropdown */}
                      <div className="flex items-center bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium shrink-0">
                        <select
                          value={summaryViewMode}
                          onChange={(e) => setSummaryViewMode(e.target.value)}
                          className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer text-xs"
                        >
                          <option value="all">All Months</option>
                          {FINANCIAL_MONTHS.map((mObj) => (
                            <option key={mObj.id} value={String(mObj.id)}>{mObj.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Clean Quiet Ledger Summary Tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs text-center">
                      {titheColumns.map(col => (
                        <div 
                          key={col.id} 
                          className="p-2 sm:p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex flex-col items-center justify-center text-center shadow-2xs transition-colors"
                        >
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate w-full">
                            {col.code}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate w-full mb-1">
                            {col.name}
                          </div>
                          <div className="font-mono text-xs sm:text-sm font-semibold text-slate-900 text-center tabular-nums">
                            ₹{(disp[col.field_key] || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                      <div className="col-span-2 sm:col-span-1 bg-slate-900 text-white p-2 sm:p-2.5 rounded-xl border border-slate-950 flex flex-col items-center justify-center text-center shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wider text-center">TOTAL</div>
                        <div className="text-[10px] text-slate-400 truncate w-full mb-1">Grand Total</div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-white text-center tabular-nums">
                          ₹{disp.total.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Search, Month Selector & Member Actions Line Directly Below Collection Box */}
              <div className="flex flex-col gap-2">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search member name or Sl No..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full py-0.5">
                  {/* Month Selection Dropdown */}
                  <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-white px-3 py-2 rounded-xl border border-slate-300 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Thla:</span>
                    </div>
                    <select
                      value={month}
                      onChange={(e) => {
                        const newM = parseInt(e.target.value);
                        setMonth(newM);
                        setSummaryViewMode(String(newM));
                      }}
                      className="font-bold text-xs bg-transparent text-slate-900 focus:outline-none cursor-pointer flex-1 text-right sm:text-left"
                      title="Select Month"
                    >
                      {FINANCIAL_MONTHS.map((mObj) => (
                        <option key={mObj.id} value={mObj.id}>{mObj.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Add Member Button */}
                  <button
                    type="button"
                    onClick={() => { setMemberToEdit(null); setShowMemberModal(true); }}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 transition-all cursor-pointer w-full"
                    title="Add New Member to Bial"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>

                  {/* Save All Button */}
                  <button
                    type="button"
                    disabled={isLocked && user.role !== 'ADMIN'}
                    onClick={handleBulkSave}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs shadow-indigo-600/20 transition-all disabled:opacity-40 cursor-pointer w-full"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save All'}</span>
                  </button>
                </div>
              </div>

              {/* Unpaid Household / Follow-up Filter Bar */}
              <div className="flex items-center justify-between gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200 text-xs shadow-2xs overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 min-w-max">
                  <button
                    type="button"
                    onClick={() => setMemberFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      memberFilter === 'all' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A VAIIN ({rawMembers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberFilter('contributed')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      memberFilter === 'contributed' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Pe Tawh ({contributedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberFilter('unpaid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      memberFilter === 'unpaid' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Pe Lo ({unpaidCount})
                  </button>
                </div>

                {unpaidCount > 0 && memberFilter !== 'unpaid' && (
                  <button
                    type="button"
                    onClick={() => setMemberFilter('unpaid')}
                    className="text-[11px] font-bold text-rose-700 hover:underline flex items-center gap-1.5 pr-1 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Chhungkaw {unpaidCount} in an pe lo</span>
                  </button>
                )}
              </div>

              {/* CLEAN PERMANENT CARD VIEW MODE */}
              <div className="space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-indigo-600 font-bold text-xs animate-pulse bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    Loading tithes card view...
                  </div>
                ) : processedMembers.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 p-6 text-xs shadow-2xs">
                    No members found. Click <span className="text-emerald-600 font-bold">Add</span> above to register a member.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
                    {((!showAllCards && processedMembers.length > 4 && !searchQuery.trim())
                      ? processedMembers.slice(0, 4)
                      : processedMembers
                    ).map((m, idx) => {
                      const rowDraft = drafts[m.member_id] || (() => {
                        const fallbackDraft = { total: 0 };
                        titheColumns.forEach(c => { fallbackDraft[c.field_key] = ''; });
                        return fallbackDraft;
                      })();

                      return (
                        <div
                          key={m.member_id}
                          onClick={() => {
                            setSelectedMemberForEditModal(m);
                            setShowMemberEditModal(true);
                          }}
                          className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between h-full group space-y-2 cursor-pointer"
                        >
                          {/* Card Header: Sl No, Name, Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                                {m.sl_no}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMemberForEditModal(m);
                                  setShowMemberEditModal(true);
                                }}
                                className="font-bold text-slate-900 text-xs sm:text-[13px] leading-tight truncate hover:text-indigo-600 transition-colors text-left flex-1 min-w-0 cursor-pointer"
                                title={`Click to edit ${m.name}`}
                              >
                                {m.name}
                              </button>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rowDraft = drafts[m.member_id] || {};
                                  setReceiptMember({ ...m, ...rowDraft });
                                }}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Print / Share Digital Receipt"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMemberForHistory(m.member_id);
                                  setShowMemberHistoryModal(true);
                                }}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="View Payment Statement"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMember(m);
                                }}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Category Breakdown (Dynamic responsive pills with proper mobile sizing) */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs font-mono">
                            {titheColumns.map(col => {
                              const rawVal = rowDraft[col.field_key] || 0;
                              const numVal = parseFloat(rawVal) || 0;
                              return (
                                <div 
                                  key={col.id} 
                                  className="p-1.5 sm:p-2 rounded-xl border flex items-center justify-between transition-colors bg-white shadow-2xs"
                                  style={{ 
                                    backgroundColor: `${col.color || '#6366f1'}08`, 
                                    borderColor: `${col.color || '#6366f1'}30` 
                                  }}
                                >
                                  <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-tight pl-0.5 truncate" style={{ color: col.color || '#1e293b' }}>
                                    {col.code}
                                  </span>
                                  <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded-md border border-slate-200/80 shadow-2xs ml-1 shrink-0">
                                    ₹{numVal.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Total Row Aligned at Bottom */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs mt-auto">
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">TOTAL</span>
                            <span className="font-mono font-black text-xs sm:text-sm text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                              ₹{(rowDraft.total || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* More / Show Less Toggle Button */}
                {processedMembers.length > 4 && !searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowAllCards(prev => !prev)}
                    className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {showAllCards ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-indigo-600" />
                        <span>Show Less (Collapse to 4 Members)</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-indigo-600" />
                        <span>Show All ({processedMembers.length} Members in Bial)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS (HISTOGRAM / BAR CHART & PIE CHART) */}
        {activeTab === 'analytics' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {analyticsLoading ? (
              <div className="py-16 text-center text-indigo-600 font-bold text-xs animate-pulse">
                Loading Bial Analytics & Charts...
              </div>
            ) : (
              <>
                {/* Dynamic Summary Cards: Each Tithe Column + Grand Total */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
                  {titheColumns.map(col => (
                    <div 
                      key={col.id} 
                      className="col-span-1 p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between"
                      style={{
                        backgroundColor: `${col.color || '#6366f1'}12`,
                        borderColor: `${col.color || '#6366f1'}35`
                      }}
                    >
                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider truncate" style={{ color: col.color || '#1e293b' }}>
                        {col.code}
                      </span>
                      <div className="font-mono font-bold text-slate-900 text-xs sm:text-sm lg:text-base truncate">
                        ₹{(grandTotals[col.field_key] || grandTotals[`total_${col.field_key}`] || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}

                  <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-2 sm:p-2.5 rounded-xl border border-indigo-700 text-white shadow-xs flex items-center justify-between px-3">
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-indigo-200 uppercase tracking-wider block">GRAND TOTAL</span>
                      <span className="text-[9px] text-slate-300 font-sans">FY {year} Total</span>
                    </div>
                    <div className="font-mono font-black text-emerald-300 text-sm sm:text-base lg:text-lg">
                      ₹{(grandTotals.grand_total || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* 1. Month-to-Month Comparative Analyser (Top Position) */}
                {(() => {
                  const targetMObj = FINANCIAL_MONTHS.find(f => f.id === compareMonthTarget);
                  const baseMObj = FINANCIAL_MONTHS.find(f => f.id === compareMonthBase);

                  const defaultMonthData = { total: 0, returned_members: 0 };
                  titheColumns.forEach(c => { defaultMonthData[c.field_key] = 0; });

                  const targetMonthData = chartMonthlyTrends.find(m => m.month === (targetMObj ? targetMObj.short : `M${compareMonthTarget}`)) || defaultMonthData;
                  const baseMonthData = chartMonthlyTrends.find(m => m.month === (baseMObj ? baseMObj.short : `M${compareMonthBase}`)) || defaultMonthData;

                  const getComparison = (targetVal = 0, baseVal = 0) => {
                    const delta = targetVal - baseVal;
                    const rate = baseVal > 0 ? ((delta / baseVal) * 100) : (targetVal > 0 ? 100 : 0);
                    return { delta, rate };
                  };

                  const categories = [
                    ...titheColumns.map(col => ({
                      key: col.field_key,
                      label: `${col.code} (${col.name.toUpperCase()})`,
                      valA: targetMonthData[col.field_key] || 0,
                      valB: baseMonthData[col.field_key] || 0
                    })),
                    { key: 'total', label: 'GRAND TOTAL', valA: targetMonthData.total || 0, valB: baseMonthData.total || 0 }
                  ];

                  const totalHouseholds = rawMembers.length || grandTotals?.total_system_members || 1;
                  const houseA = targetMonthData.returned_members || 0;
                  const houseB = baseMonthData.returned_members || 0;
                  const houseDelta = houseA - houseB;
                  const rateA = Math.round((houseA / totalHouseholds) * 100);
                  const rateB = Math.round((houseB / totalHouseholds) * 100);
                  const rateDiff = rateA - rateB;
                  const isHousePositive = houseDelta >= 0;

                  const targetName = `${targetMObj?.name || 'Selected'}`;
                  const baseName = `${baseMObj?.name || 'Reference'}`;

                  return (
                    <div className="glass-panel p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl space-y-3 shadow-xs">
                      {/* Compact Single-Line Control Header */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown className="w-4 h-4 text-indigo-600 shrink-0" />
                          <h3 className="text-xs sm:text-sm font-black font-heading text-slate-900 truncate">
                            Month-to-Month Comparative Analyser
                          </h3>
                        </div>

                        {/* Month Selectors on a Single Line */}
                        <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold shrink-0 bg-white px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <select
                              value={compareMonthTarget}
                              onChange={(e) => setCompareMonthTarget(parseInt(e.target.value))}
                              className="bg-transparent font-extrabold text-indigo-950 focus:outline-none cursor-pointer text-xs sm:text-sm"
                            >
                              {FINANCIAL_MONTHS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </div>

                          <span className="text-slate-400 text-xs sm:text-sm font-black px-1 sm:px-1.5">VS</span>

                          <div className="flex items-center gap-1">
                            <select
                              value={compareMonthBase}
                              onChange={(e) => setCompareMonthBase(parseInt(e.target.value))}
                              className="bg-transparent font-extrabold text-slate-900 focus:outline-none cursor-pointer text-xs sm:text-sm"
                            >
                              {FINANCIAL_MONTHS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>


                      {/* Monetary Figures Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        {categories.map(item => {
                          const comp = getComparison(item.valA, item.valB);
                          const isPositive = comp.delta >= 0;

                          return (
                            <div key={item.key} className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2 hover:border-indigo-300 transition-all">
                              <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                                {item.label}
                              </span>

                              {/* Month Figures in Single Lines */}
                              <div className="space-y-1 text-xs font-mono">
                                <div className="flex justify-between items-center bg-indigo-50/70 px-2 py-1 rounded-lg border border-indigo-100">
                                  <span className="text-[10px] sm:text-[10.5px] font-bold text-indigo-800 font-sans truncate">{targetName}:</span>
                                  <span className="font-extrabold text-indigo-950">₹{item.valA.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                  <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-600 font-sans truncate">{baseName}:</span>
                                  <span className="font-bold text-slate-800">₹{item.valB.toLocaleString('en-IN')}</span>
                                </div>
                              </div>

                              {/* Difference & Rate of Return Badge */}
                              <div className="pt-1.5 border-t border-slate-100 space-y-1">
                                <div className="flex items-center justify-between text-xs font-mono font-extrabold">
                                  <span className="text-[9.5px] font-bold text-slate-500 font-sans uppercase">Diff:</span>
                                  <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                                    {isPositive ? '+' : ''}₹{comp.delta.toLocaleString('en-IN')}
                                  </span>
                                </div>
                                <div className={`w-full py-0.5 px-1.5 rounded-md text-center font-bold text-[9.5px] font-sans flex items-center justify-center gap-1 ${
                                  isPositive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  <span>{isPositive ? '▲' : '▼'}</span>
                                  <span>{Math.abs(comp.rate).toFixed(1)}% {isPositive ? 'INCREASE' : 'DECREASE'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Histogram / Bar Chart */}
                  <div className="glass-panel p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-2.5">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      <span>Monthly Collection Trends (FY {year})</span>
                    </h3>
                    <div className="h-56 sm:h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartMonthlyTrends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }}
                            formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Collected']}
                            labelFormatter={(label, items) => {
                              const item = items?.[0]?.payload;
                              return item ? item.fullMonth : label;
                            }}
                          />
                          <Bar dataKey="total" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pie Chart */}
                  <div className="glass-panel p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-2.5">
                      <PieChartIcon className="w-4 h-4 text-emerald-600" />
                      <span>Category Allocation Ratio</span>
                    </h3>
                    <div className="h-56 sm:h-64 w-full">
                      {pieChartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          No collection data recorded for FY {year} yet.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="45%"
                              innerRadius={36}
                              outerRadius={65}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }}
                              formatter={(val) => [`₹${val.toLocaleString('en-IN')}`]}
                            />
                            <Legend wrapperStyle={{ color: '#475569', fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {/* MODALS (Lazy-Loaded via Suspense for optimal mobile performance) */}
      <React.Suspense fallback={null}>
        {showMemberModal && (
          <MemberModal
            isOpen={showMemberModal}
            onClose={() => setShowMemberModal(false)}
            onSave={handleSaveMember}
            memberToEdit={memberToEdit}
            nextSlNo={rawMembers.length + 1}
          />
        )}

        {showYearlySummaryModal && (
          <BialYearlySummaryModal
            isOpen={showYearlySummaryModal}
            onClose={() => setShowYearlySummaryModal(false)}
            bialId={targetBialId}
            initialYear={year}
            showToast={showToast}
            onSelectMember={(mId) => {
              setSelectedMemberForHistory(mId);
              setShowMemberHistoryModal(true);
            }}
          />
        )}

        {showMemberHistoryModal && (
          <MemberHistoryModal
            isOpen={showMemberHistoryModal}
            onClose={() => setShowMemberHistoryModal(false)}
            memberId={selectedMemberForHistory}
            initialYear={year}
            showToast={showToast}
            onUpdate={loadLedger}
            canExport={false}
          />
        )}

        {showMemberEditModal && (
          <BialMemberEditModal
            isOpen={showMemberEditModal}
            onClose={() => {
              setShowMemberEditModal(false);
              setSelectedMemberForEditModal(null);
            }}
            columns={titheColumns}
            member={selectedMemberForEditModal ? {
              ...selectedMemberForEditModal,
              ...(drafts[selectedMemberForEditModal.member_id] || {})
            } : null}
            bialName={bialName}
            bialId={targetBialId}
            year={year}
            month={month}
            isLocked={isLocked && user.role !== 'ADMIN'}
            onSaved={() => {
              loadLedger();
            }}
            showToast={showToast}
          />
        )}

        {Boolean(receiptMember) && (
          <DigitalReceiptModal
            isOpen={Boolean(receiptMember)}
            onClose={() => setReceiptMember(null)}
            member={receiptMember ? {
              ...receiptMember,
              ...(drafts[receiptMember.member_id] || {})
            } : null}
            month={month}
            year={year}
            bialName={bialName}
            columns={titheColumns}
            showToast={showToast}
          />
        )}
      </React.Suspense>

    </div>
  );
}
