import React, { useState, useEffect } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import {
  Building2, Plus, Lock, Unlock, Key, Trash2, Calendar, Download,
  Upload, BarChart3, PieChart as PieChartIcon, TrendingUp, TrendingDown, ShieldAlert,
  FileSpreadsheet, FileText, Search, RefreshCw, Eye, ArrowUp, ArrowDown, ArrowUpDown,
  CalendarDays, LogOut, LayoutGrid, LayoutList, Shield, Users, CheckCircle2, Edit3,
  ArrowRightLeft, Trophy, Percent, Wallet, ChevronDown, ChevronUp, IndianRupee,
  ArrowUpRight, ArrowDownRight, Menu
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';

import { api, setAuthToken, setAuthUser } from '../utils/api';
import Modal from '../components/common/Modal';
import BialModal from '../components/BialModal';
import BialCredentialsModal from '../components/BialCredentialsModal';
import MonthMatrixModal from '../components/MonthMatrixModal';
import FinancialYearModal from '../components/FinancialYearModal';
import AdminMemberEditModal from '../components/AdminMemberEditModal';
import MemberTransferModal from '../components/MemberTransferModal';
import MemberRolloverModal from '../components/MemberRolloverModal';
import OfficialReportModal from '../components/OfficialReportModal';
import ManageColumnsModal from '../components/ManageColumnsModal';
import TitheColumnsTab from '../components/TitheColumnsTab';
import churchLogo from '../assets/church_logo.jpg';
import {
  exportAdminConsolidatedPDF,
  exportAdminConsolidatedExcel,
  exportToExcel,
  exportToPDF,
  exportOverallMemberExcel,
  exportOverallMemberPDF
} from '../utils/exportEngine';
import { FINANCIAL_MONTHS, DEFAULT_TITHE_COLUMNS } from '../utils/constants';

const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7'];

export default function AdminDashboard({ user, showToast }) {
  const [activeTab, setActiveTab] = useState('bials'); // 'bials' | 'inspector' | 'columns' | 'analytics' | 'backups'
  const [financialYears, setFinancialYears] = useState([2024, 2025, 2026, 2027]);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState(null);
  const [bials, setBials] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bialViewMode, setBialViewMode] = useState('table'); // 'table' | 'card'
  const [inspectorViewMode, setInspectorViewMode] = useState('table'); // 'table' | 'card'
  const [showAllBialCards, setShowAllBialCards] = useState(false);
  const [showAllInspectorCards, setShowAllInspectorCards] = useState(false);

  // Modals
  const [showBialModal, setShowBialModal] = useState(false);
  const [bialToEdit, setBialToEdit] = useState(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [showConsolidatedModal, setShowConsolidatedModal] = useState(false);
  const [showReportFormModal, setShowReportFormModal] = useState(false);
  const [showInspectorExportModal, setShowInspectorExportModal] = useState(false);
  const [selectedMemberToEdit, setSelectedMemberToEdit] = useState(null);
  const [showMemberEditModal, setShowMemberEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [titheColumns, setTitheColumns] = useState(DEFAULT_TITHE_COLUMNS);
  const [transferPreselectedMember, setTransferPreselectedMember] = useState(null);
  const [transferPreselectedBialId, setTransferPreselectedBialId] = useState(null);

  // Overall Totals Filter State
  const [overallBialFilter, setOverallBialFilter] = useState('all'); // 'all' | bial_id
  const [overallMonthFilter, setOverallMonthFilter] = useState('all'); // 'all' | month_id (1-12)
  const [compareMonthTarget, setCompareMonthTarget] = useState(5); // Month A (Target: May)
  const [compareMonthBase, setCompareMonthBase] = useState(4); // Month B (Base: April)

  // Inspector Tab State
  const [inspectorBialId, setInspectorBialId] = useState('all');
  const [inspectorMonth, setInspectorMonth] = useState(4); // Default to April
  const [inspectorLedger, setInspectorLedger] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorSearchQuery, setInspectorSearchQuery] = useState('');

  // Inspector Sorting State
  const [sortField, setSortField] = useState('sl_no');
  const [sortDirection, setSortDirection] = useState('asc');

  // Restore file
  const [selectedFile, setSelectedFile] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    window.location.href = '/';
  };

  const handleExportOverall = async (format = 'excel') => {
    try {
      showToast(`Generating Overall Ledger ${format.toUpperCase()} export...`, 'info');
      if (format === 'excel') {
        await exportOverallMemberExcel({ year, bialsData: stats?.bialsData || [], churchGrandTotal: stats?.grandTotals || {}, columns: titheColumns });
      } else {
        await exportOverallMemberPDF({ year, bialsData: stats?.bialsData || [], churchGrandTotal: stats?.grandTotals || {}, columns: titheColumns });
      }
      showToast(`Overall Ledger exported successfully!`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast(err.message || 'Export failed', 'error');
    }
  };

  const loadFinancialYears = async () => {
    try {
      const res = await api.getFinancialYears();
      if (res && res.years) {
        const yearsList = res.years;
        const actYear = res.activeYear || (yearsList.length > 0 ? yearsList[yearsList.length - 1] : new Date().getFullYear());
        setFinancialYears(yearsList);
        setActiveYear(actYear);
        if (!yearsList.includes(year)) {
          setYear(actYear);
        }
      }
    } catch (err) {
      console.error('Error loading financial years:', err);
    }
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [dashRes, bialsRes, backupsRes] = await Promise.all([
        api.getAdminDashboard(year, { bial_id: overallBialFilter, month: overallMonthFilter }),
        api.getBials(year),
        api.getBackupsList().catch(() => [])
      ]);

      setStats(dashRes);
      setBials(bialsRes || []);
      setBackups(backupsRes || []);

      if (dashRes?.columns && Array.isArray(dashRes.columns) && dashRes.columns.length > 0) {
        setTitheColumns(dashRes.columns);
      }

      if (bialsRes && bialsRes.length > 0 && !inspectorBialId) {
        setInspectorBialId(bialsRes[0].id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load admin dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialYears();
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [year, overallBialFilter, overallMonthFilter]);

  // Real-time synchronization for Tithe Columns and Headers across all tabs, inspector, and devices
  useEffect(() => {
    let bc;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('tithe_columns_sync');
        bc.onmessage = () => {
          loadAdminData();
          if (activeTab === 'inspector') {
            loadInspectorLedger();
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    const handleStorage = (e) => {
      if (e.key === 'tithe_columns_updated') {
        loadAdminData();
        if (activeTab === 'inspector') {
          loadInspectorLedger();
        }
      }
    };

    const handleCustom = () => {
      loadAdminData();
      if (activeTab === 'inspector') {
        loadInspectorLedger();
      }
    };

    const checkColumnsSignature = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await api.getColumns();
        const cols = Array.isArray(res) ? res : (res?.columns || []);
        if (cols && cols.length > 0) {
          setTitheColumns(prev => {
            const prevSig = (prev || []).map(c => `${c.id}_${c.name}_${c.code}_${c.color}_${c.display_order}`).join('|');
            const newSig = cols.map(c => `${c.id}_${c.name}_${c.code}_${c.color}_${c.display_order}`).join('|');
            if (prevSig !== newSig) {
              loadAdminData();
              if (activeTab === 'inspector') {
                loadInspectorLedger();
              }
              return cols;
            }
            return prev;
          });
        }
      } catch (e) {
        // Silent catch for background polling
      }
    };

    const pollInterval = setInterval(checkColumnsSignature, 45000);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('tithe-columns-updated', handleCustom);
    window.addEventListener('focus', checkColumnsSignature);
    document.addEventListener('visibilitychange', checkColumnsSignature);

    return () => {
      if (bc) bc.close();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tithe-columns-updated', handleCustom);
      window.removeEventListener('focus', checkColumnsSignature);
      document.removeEventListener('visibilitychange', checkColumnsSignature);
    };
  }, [activeTab, inspectorBialId, year, inspectorMonth]);

  const loadInspectorLedger = async () => {
    if (!inspectorBialId) return;
    try {
      setInspectorLoading(true);
      if (inspectorBialId === 'all') {
        try {
          const res = await api.getTithes('all', year, inspectorMonth);
          if (res && res.members && Array.isArray(res.members)) {
            setInspectorLedger(res);
            if (res.columns && Array.isArray(res.columns) && res.columns.length > 0) {
              setTitheColumns(res.columns);
            }
            return;
          }
        } catch (e) {
          // Fallback to fetching per bial
        }

        // Fetch each Bial's ledger and aggregate in Bial 1... natural sorted order
        const sortedBials = [...bials].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        let discoveredCols = titheColumns;

        const bialResults = await Promise.all(
          sortedBials.map(async (b) => {
            try {
              const res = await api.getTithes(b.id, year, inspectorMonth);
              if (res?.columns && Array.isArray(res.columns) && res.columns.length > 0) {
                discoveredCols = res.columns;
              }
              const members = (res.members || []).map(m => ({
                ...m,
                bial_id: b.id,
                bial_name: b.name,
                bial_code: b.code
              }));
              members.sort((a, b) => (a.sl_no || 0) - (b.sl_no || 0));
              return members;
            } catch (e) {
              return [];
            }
          })
        );

        if (discoveredCols && discoveredCols.length > 0) {
          setTitheColumns(discoveredCols);
        }

        const allMembersRaw = bialResults.flat();
        let runningSerial = 1;
        const allMembers = allMembersRaw.map((m) => ({
          ...m,
          original_sl_no: m.sl_no,
          global_sl_no: runningSerial,
          display_sl_no: runningSerial,
          sl_no: runningSerial++
        }));

        const colSums = { grand_total: 0 };
        discoveredCols.forEach(c => {
          colSums[c.field_key] = 0;
          colSums[`sum_${c.field_key}`] = 0;
        });
        allMembers.forEach(m => {
          discoveredCols.forEach(c => {
            const v = m[c.field_key] || 0;
            colSums[c.field_key] += v;
            colSums[`sum_${c.field_key}`] += v;
          });
          colSums.grand_total += (m.total || 0);
        });

        // Legacy compat:
        colSums.sum_pathian_ram = colSums.pathian_ram || 0;
        colSums.sum_ramthar = colSums.ramthar || 0;
        colSums.sum_tualchhung = colSums.tualchhung || 0;
        colSums.sum_building = colSums.building || 0;

        setInspectorLedger({
          bial_id: 'all',
          year,
          month: inspectorMonth,
          is_locked: false,
          members: allMembers,
          summary: colSums,
          columns: discoveredCols
        });
      } else {
        const res = await api.getTithes(inspectorBialId, year, inspectorMonth);
        setInspectorLedger(res);
        if (res?.columns && Array.isArray(res.columns) && res.columns.length > 0) {
          setTitheColumns(res.columns);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to load Bial monthly ledger', 'error');
    } finally {
      setInspectorLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inspector' && inspectorBialId) {
      loadInspectorLedger();
    }
  }, [activeTab, inspectorBialId, inspectorMonth, year]);

  // Bial Actions
  const handleSaveBial = async (bialData) => {
    try {
      if (bialData.id) {
        await api.updateBial(bialData.id, bialData);
        showToast('Bial account updated successfully!', 'success');
      } else {
        await api.createBial(bialData);
        showToast('New Bial account created!', 'success');
      }
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to save Bial', 'error');
    }
  };

  const handleDeleteBial = async (bial) => {
    if (!window.confirm(`Are you sure you want to delete "${bial.name}" and ALL member/tithe records under it?`)) {
      return;
    }
    try {
      await api.deleteBial(bial.id);
      showToast(`Bial "${bial.name}" deleted.`, 'info');
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to delete Bial', 'error');
    }
  };

  const handleToggleAccountStatus = async (bial) => {
    const newStatus = bial.status === 'active' ? 'locked' : 'active';
    try {
      await api.updateBial(bial.id, { status: newStatus });
      showToast(`Bial account ${newStatus === 'locked' ? 'Locked' : 'Unlocked'}`, 'success');
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to update account status', 'error');
    }
  };

  // Backup & Restore Actions
  const handleBackupNow = async () => {
    try {
      showToast('Generating system snapshot backup...', 'info');
      await api.triggerBackupNow();
      showToast('Database backup downloaded successfully!', 'success');
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Backup failed', 'error');
    }
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please select a JSON backup file to restore', 'error');
      return;
    }

    if (!window.confirm('WARNING: Restoring database will OVERWRITE all current records with the contents of the backup file. Continue?')) {
      return;
    }

    try {
      setRestoring(true);
      const res = await api.restoreBackup(selectedFile);
      showToast(res.message || 'Database successfully restored!', 'success');
      setSelectedFile(null);
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Restore failed', 'error');
    } finally {
      setRestoring(false);
    }
  };

  // Sorting Handler for Inspector Table
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
      <ArrowUp className="w-3 h-3 text-indigo-400 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400 font-bold" />
    );
  };

  const filteredBials = bials.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grandTotals = stats?.grandTotals || {};
  const rawBialBreakdown = stats?.bialBreakdown || [];

  // Compute enriched bial breakdown with return rates and shares
  const grandTotalVal = grandTotals.grand_total || 0;
  const enrichedBialBreakdown = rawBialBreakdown.map((b) => {
    const matchingBial = bials.find(x => x.id === b.id);
    const totalMembers = b.total_members ?? matchingBial?.member_count ?? 0;
    const returnedMembers = b.returned_members ?? (b.total > 0 ? totalMembers : 0);
    const returnRate = b.return_rate ?? (totalMembers > 0 ? Math.round((returnedMembers / totalMembers) * 1000) / 10 : 0);
    const percentageShare = b.percentage_share ?? (grandTotalVal > 0 ? Math.round((b.total / grandTotalVal) * 1000) / 10 : 0);
    const avgPerMember = b.avg_per_member ?? (returnedMembers > 0 ? Math.round(b.total / returnedMembers) : 0);

    return {
      ...b,
      total_members: totalMembers,
      returned_members: returnedMembers,
      return_rate: returnRate,
      percentage_share: percentageShare,
      avg_per_member: avgPerMember
    };
  });

  const totalSystemMembers = grandTotals.total_system_members ?? bials.reduce((acc, b) => acc + (b.member_count || 0), 0);
  const totalReturnedMembers = grandTotals.total_returned_members ?? enrichedBialBreakdown.reduce((acc, b) => acc + (b.returned_members || 0), 0);
  const overallReturnRate = grandTotals.overall_return_rate ?? (totalSystemMembers > 0 ? Math.round((totalReturnedMembers / totalSystemMembers) * 1000) / 10 : 0);
  const avgContributionPerMember = grandTotals.avg_contribution_per_member ?? (totalReturnedMembers > 0 ? Math.round(grandTotalVal / totalReturnedMembers) : 0);
  const pendingMembers = grandTotals.pending_members ?? Math.max(0, totalSystemMembers - totalReturnedMembers);

  const topContributingBial = grandTotals.top_contributing_bial ?? (
    enrichedBialBreakdown.length > 0 && enrichedBialBreakdown[0].total > 0
      ? enrichedBialBreakdown[0]
      : null
  );

  // Financial Months Definition & Month-over-Month Comparison Data
  const FINANCIAL_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const FINANCIAL_MONTH_NAMES = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
  };
  const FINANCIAL_FULL_NAMES = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
    7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
  };

  const getPreviousFinancialMonth = (m) => {
    const idx = FINANCIAL_MONTH_ORDER.indexOf(m);
    if (idx === -1) return 4;
    return idx === 0 ? FINANCIAL_MONTH_ORDER[FINANCIAL_MONTH_ORDER.length - 1] : FINANCIAL_MONTH_ORDER[idx - 1];
  };

  const currMonthNum = compareMonthTarget || 5;
  const prevMonthNum = compareMonthBase || 4;
  const currMonthLabel = FINANCIAL_MONTH_NAMES[currMonthNum];
  const prevMonthLabel = FINANCIAL_MONTH_NAMES[prevMonthNum];
  const currMonthFullName = FINANCIAL_FULL_NAMES[currMonthNum];
  const prevMonthFullName = FINANCIAL_FULL_NAMES[prevMonthNum];

  const currMonthTrend = (stats?.monthlyTrends || []).find(m => m.monthNum === currMonthNum) || {
    month: currMonthLabel,
    monthNum: currMonthNum,
    total: 0,
    pathian_ram: 0,
    ramthar: 0,
    tualchhung: 0,
    building: 0,
    returned_members: 0,
    return_rate: 0
  };

  const prevMonthTrend = (stats?.monthlyTrends || []).find(m => m.monthNum === prevMonthNum) || {
    month: prevMonthLabel,
    monthNum: prevMonthNum,
    total: 0,
    pathian_ram: 0,
    ramthar: 0,
    tualchhung: 0,
    building: 0,
    returned_members: 0,
    return_rate: 0
  };

  // Monetary Comparison
  const currTotal = currMonthTrend.total || 0;
  const prevTotal = prevMonthTrend.total || 0;
  const monetaryDiff = currTotal - prevTotal;
  const monetaryDiffPercent = prevTotal > 0
    ? Math.round(((currTotal - prevTotal) / prevTotal) * 1000) / 10
    : (currTotal > 0 ? 100 : 0);

  // Household Return Comparison
  const currReturned = currMonthTrend.returned_members || 0;
  const prevReturned = prevMonthTrend.returned_members || 0;
  const currReturnRate = currMonthTrend.return_rate || 0;
  const prevReturnRate = prevMonthTrend.return_rate || 0;
  const returnedDiff = currReturned - prevReturned;
  const returnRateDiff = Math.round((currReturnRate - prevReturnRate) * 10) / 10;

  // Comparison Bar Chart data (grouped) - fully dynamic based on active tithe columns
  const comparisonBarData = [
    {
      category: 'Total',
      [prevMonthLabel]: prevTotal,
      [currMonthLabel]: currTotal
    },
    ...titheColumns.map(col => ({
      category: col.code,
      [prevMonthLabel]: prevMonthTrend[col.field_key] || 0,
      [currMonthLabel]: currMonthTrend[col.field_key] || 0
    }))
  ];

  const pieChartData = titheColumns.map(col => ({
    name: col.code,
    value: grandTotals[col.field_key] || grandTotals[`total_${col.field_key}`] || 0,
    color: col.color || '#6366f1'
  })).filter(d => d.value > 0);

  // Inspector Members Filtering & Sorting
  const inspectorMembers = inspectorLedger?.members || [];
  const filteredInspectorMembers = inspectorMembers.filter(m => {
    if (!inspectorSearchQuery.trim()) return true;
    const q = inspectorSearchQuery.toLowerCase().trim();
    return (
      m.name.toLowerCase().includes(q) ||
      String(m.sl_no).includes(q) ||
      (m.bial_name && m.bial_name.toLowerCase().includes(q)) ||
      (m.bial_code && m.bial_code.toLowerCase().includes(q))
    );
  });

  const sortedInspectorMembers = [...filteredInspectorMembers].sort((a, b) => {
    let aVal, bVal;
    if (sortField === 'sl_no') {
      aVal = a.sl_no;
      bVal = b.sl_no;
    } else if (sortField === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (sortField === 'bial_name') {
      aVal = (a.bial_name || '').toLowerCase();
      bVal = (b.bial_name || '').toLowerCase();
    } else {
      aVal = a[sortField] || 0;
      bVal = b[sortField] || 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const selectedBialObj = inspectorBialId === 'all'
    ? { id: 'all', name: 'All Bials', code: 'ALL' }
    : bials.find(b => b.id === parseInt(inspectorBialId)) || { name: 'Bial', code: '' };

  return (
    <div className="min-h-screen text-slate-900 p-2.5 sm:p-3.5 lg:p-4">
      
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start gap-3 sm:gap-4 lg:gap-5">
        
        {/* Mobile Drawer & Desktop Left Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenTransfer={() => {
            setTransferPreselectedMember(null);
            setTransferPreselectedBialId(null);
            setShowTransferModal(true);
          }}
          onOpenConsolidated={() => setShowConsolidatedModal(true)}
          onOpenReportForm={() => setShowReportFormModal(true)}
          onOpenMatrix={() => setShowMatrixModal(true)}
          onOpenCredentials={() => setShowCredentialsModal(true)}
          onOpenYears={() => setShowYearModal(true)}
          onOpenColumns={() => setActiveTab('columns')}
          year={year}
          setYear={setYear}
          financialYears={financialYears}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 w-full space-y-2.5 sm:space-y-3">
          


        {/* AGGREGATED SYSTEM TOTALS */}
        <div className="glass-panel p-2.5 sm:p-3.5 rounded-2xl sm:rounded-3xl space-y-2">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
                title="Open Admin Menu"
              >
                <Menu className="w-3.5 h-3.5" />
                <span>Menu</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 tracking-wide">
                  OVERALL ({year}-{year + 1})
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-[11px] border border-indigo-100">
                  FY {year}
                </span>
              </div>
            </div>

            {/* Dropdowns */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <select
                value={overallBialFilter}
                onChange={(e) => setOverallBialFilter(e.target.value)}
                className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                title="Filter contributions by Bial"
              >
                <option value="all">All Bials</option>
                {bials.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select
                value={overallMonthFilter}
                onChange={(e) => setOverallMonthFilter(e.target.value)}
                className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                title="Filter contributions by Month"
              >
                <option value="all">All Months</option>
                {FINANCIAL_MONTHS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Tithe Category Summary Cards + Grand Total */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
            {titheColumns.map((col) => {
              const amount = grandTotals[col.field_key] || grandTotals[`total_${col.field_key}`] || 0;
              return (
                <div
                  key={col.id}
                  className="p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between transition-all shadow-2xs"
                  style={{
                    backgroundColor: `${col.color || '#6366f1'}10`,
                    borderColor: `${col.color || '#6366f1'}35`
                  }}
                >
                  <div className="flex items-center justify-between mb-1 gap-1 min-w-0">
                    <span
                      className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate"
                      style={{ color: col.color || '#1e293b' }}
                    >
                      {col.code}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-500 truncate text-right">
                      {col.name}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums font-black text-slate-900 text-sm sm:text-base lg:text-lg tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    ₹{amount.toLocaleString('en-IN')}
                  </div>
                </div>
              );
            })}

            {/* GRAND TOTAL BOX */}
            <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-2 sm:p-2.5 rounded-xl border border-indigo-700/60 text-white shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-extrabold text-indigo-200 uppercase tracking-wider">TOTAL</span>
                <span className="text-[9px] font-semibold text-indigo-300">Grand Total</span>
              </div>
              <div className="font-mono tabular-nums font-black text-emerald-300 text-sm sm:text-base lg:text-lg tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                ₹{(grandTotals.grand_total || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>



        {/* TAB 1: MAIN (BIALS MANAGEMENT) */}
        {activeTab === 'bials' && (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            {/* Control Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Bials..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center">
                {/* View Mode Toggle: Table / Card */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    onClick={() => setBialViewMode('table')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      bialViewMode === 'table'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Table View"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>

                  <button
                    onClick={() => setBialViewMode('card')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      bialViewMode === 'card'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Card View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>
                </div>

                <button
                  onClick={() => { setBialToEdit(null); setShowBialModal(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> <span>Add</span>
                </button>
              </div>
            </div>

            {/* View Option 1: TABLE VIEW */}
            {bialViewMode === 'table' && (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-2.5 px-2.5 w-12 text-center">Sl No</th>
                        <th className="py-2.5 px-3">Bial Name</th>
                        <th className="py-2.5 px-2 text-center w-20">Members</th>
                        <th className="py-2.5 px-3 text-right w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                      {filteredBials.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-xs text-slate-500 font-sans">
                            No Bial accounts found.
                          </td>
                        </tr>
                      ) : (
                        filteredBials.map((b, idx) => (
                          <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-500 text-xs">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => {
                                  setInspectorBialId(b.id);
                                  setActiveTab('inspector');
                                }}
                                className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline text-left cursor-pointer transition-colors"
                                title="Click to open Bial ledger"
                              >
                                {b.name}
                              </button>
                            </td>
                            <td className="py-2.5 px-2 text-center font-semibold text-slate-700">{b.member_count}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">₹{(b.total_collected || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* View Option 2: CARD VIEW - Mobile Friendly Grid */}
            {bialViewMode === 'card' && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredBials.length === 0 ? (
                    <div className="col-span-2 py-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                      No Bial accounts found.
                    </div>
                  ) : (
                    ((!showAllBialCards && !searchQuery.trim() && filteredBials.length > 6)
                      ? filteredBials.slice(0, 6)
                      : filteredBials
                    ).map((b, idx) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          setInspectorBialId(b.id);
                          setActiveTab('inspector');
                        }}
                        className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-2 active:scale-[0.98]"
                        title="Click to view Bial ledger"
                      >
                        {/* Card Top: Sl No & Bial Name */}
                        <div className="flex items-start gap-1.5 min-w-0">
                          <span className="w-4 h-4 rounded-md bg-indigo-100 text-indigo-700 font-mono font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-indigo-700 text-xs sm:text-sm leading-snug break-words flex-1 hover:underline">
                            {b.name}
                          </h4>
                        </div>

                        {/* Card Metrics: Separate lines for Members and Total */}
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Members:</span>
                            <span className="font-bold text-slate-800">{b.member_count}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Total:</span>
                            <span className="font-mono font-bold text-emerald-700">₹{(b.total_collected || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* More / Show Less Toggle Button (3 lines = 6 Bials) */}
                {filteredBials.length > 6 && !searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowAllBialCards(prev => !prev)}
                    className="w-full py-2 px-4 rounded-2xl bg-white hover:bg-slate-50 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {showAllBialCards ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-indigo-600" />
                        <span>Show Less (Collapse to 6 Bials)</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-indigo-600" />
                        <span>More ({filteredBials.length - 6} more Bials)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INSPECT BIAL MONTHLY LEDGER */}
        {activeTab === 'inspector' && (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            {/* Compact Dropdown & Export Controls */}
            <div className="glass-panel p-2.5 sm:p-3 rounded-2xl">
              <div className="flex flex-col gap-2 w-full max-w-4xl mx-auto">
                {/* Top Row: Bial Selection, Month, Financial Year, and Export Button */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  
                  {/* Bial Selector */}
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                      Bial Selection
                    </span>
                    <select
                      value={inspectorBialId || 'all'}
                      onChange={(e) => setInspectorBialId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                      className="w-full font-bold text-xs px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer truncate"
                    >
                      <option value="all">ALL BIAL</option>
                      {bials.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Month Selector */}
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                      Month
                    </span>
                    <select
                      value={inspectorMonth}
                      onChange={(e) => setInspectorMonth(parseInt(e.target.value))}
                      className="w-full font-bold text-xs px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer truncate"
                    >
                      {FINANCIAL_MONTHS.map((mObj) => (
                        <option key={mObj.id} value={mObj.id}>{mObj.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Financial Year Selector */}
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                      Financial Year
                    </span>
                    <select
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                      className="w-full font-mono font-bold text-xs px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer truncate"
                    >
                      {financialYears.map(y => (
                        <option key={y} value={y}>FY {y} - {y + 1}</option>
                      ))}
                    </select>
                  </div>

                  {/* Export Button */}
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 opacity-0 pointer-events-none hidden sm:block">
                      Export
                    </span>
                    <button
                      onClick={() => setShowInspectorExportModal(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold border border-slate-300 text-xs transition-colors shadow-2xs cursor-pointer h-[32px] sm:h-[34px]"
                      title="Export Ledger (Excel / PDF)"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Search Member Bar (Left) and View Mode Controls (Right) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                  {/* Member Search Bar */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inspectorSearchQuery}
                      onChange={(e) => setInspectorSearchQuery(e.target.value)}
                      placeholder={inspectorBialId === 'all' ? "Search member across all Bials..." : `Search member in ${selectedBialObj?.name || 'Bial'}...`}
                      className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                    />
                    {inspectorSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setInspectorSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* View Mode Toggle: Table / Cards */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs self-end sm:self-center shrink-0">
                    <button
                      onClick={() => setInspectorViewMode('table')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inspectorViewMode === 'table'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Table View"
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>

                    <button
                      onClick={() => setInspectorViewMode('card')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        inspectorViewMode === 'card'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Cards View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Cards</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* VIEW MODE 1: TABLE VIEW */}
            {inspectorViewMode === 'table' && (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[65vh]">
                  <table className="w-full text-left border-collapse min-w-[640px] sm:min-w-0">
                    <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200">
                      <tr className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th onClick={() => handleSort('sl_no')} className="py-2.5 px-2.5 text-center w-14 sortable-header cursor-pointer select-none">
                          <div className="flex items-center justify-center gap-1"><span>Sl</span>{getSortIcon('sl_no')}</div>
                        </th>
                        <th onClick={() => handleSort('name')} className="py-2.5 px-3 sortable-header cursor-pointer select-none">
                          <div className="flex items-center gap-1"><span>Hming (Member Name)</span>{getSortIcon('name')}</div>
                        </th>
                        {titheColumns.map(col => (
                          <th key={col.id} onClick={() => handleSort(col.field_key)} className="py-2.5 px-2.5 text-right w-24 sm:w-28 sortable-header cursor-pointer select-none">
                            <div className="flex items-center justify-end gap-1">
                              <span style={{ color: col.color || '#334155' }}>{col.code}</span>
                              {getSortIcon(col.field_key)}
                            </div>
                          </th>
                        ))}
                        <th onClick={() => handleSort('total')} className="py-2.5 px-3 text-right w-28 sm:w-32 sortable-header cursor-pointer select-none">
                          <div className="flex items-center justify-end gap-1 text-emerald-800 font-extrabold"><span>Total</span>{getSortIcon('total')}</div>
                        </th>
                        <th className="py-2.5 px-2 text-center w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-mono tabular-nums">
                      {inspectorLoading ? (
                        <tr><td colSpan={3 + titheColumns.length} className="py-10 text-center text-indigo-600 font-semibold animate-pulse font-sans">Loading ledger...</td></tr>
                      ) : sortedInspectorMembers.length === 0 ? (
                        <tr><td colSpan={3 + titheColumns.length} className="py-10 text-center text-slate-500 font-sans">No tithes recorded.</td></tr>
                      ) : (
                        sortedInspectorMembers.map(m => (
                          <tr key={m.member_id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-2.5 text-center text-xs text-slate-500 font-semibold">{m.sl_no}</td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-900 truncate max-w-[200px] sm:max-w-none">
                              <button
                                onClick={() => {
                                  setSelectedMemberToEdit(m);
                                  setShowMemberEditModal(true);
                                }}
                                className="font-bold text-slate-900 hover:text-indigo-600 hover:underline text-left cursor-pointer transition-colors flex flex-col items-start gap-0.5 max-w-full"
                                title="Click to edit member details and tithes"
                              >
                                <div className="flex items-center gap-1.5 max-w-full truncate">
                                  <span className="truncate text-xs sm:text-sm font-bold text-slate-900">{m.name}</span>
                                  <Edit3 className="w-3 h-3 text-slate-400 opacity-60 hover:opacity-100 shrink-0" />
                                </div>
                                {inspectorBialId === 'all' && m.bial_name && (
                                  <span className="text-[10px] text-slate-500 font-medium font-sans leading-tight">
                                    {m.bial_name}
                                  </span>
                                )}
                              </button>
                            </td>
                            {titheColumns.map(col => (
                              <td key={col.id} className="py-2 px-2.5 text-right font-medium" style={{ color: col.color || '#334155' }}>
                                ₹{(m[col.field_key] || 0).toLocaleString('en-IN')}
                              </td>
                            ))}
                            <td className="py-2 px-3 text-right font-extrabold text-emerald-900 bg-emerald-50/40">₹{(m.total || 0).toLocaleString('en-IN')}</td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTransferPreselectedMember(m);
                                    setTransferPreselectedBialId(inspectorBialId);
                                    setShowTransferModal(true);
                                  }}
                                  className="p-1 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title={`Transfer ${m.name} to another Bial`}
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedMemberToEdit(m);
                                    setShowMemberEditModal(true);
                                  }}
                                  className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Edit member details & tithes"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {inspectorLedger?.summary && (
                      <tfoot className="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-mono font-extrabold text-xs sm:text-sm tabular-nums">
                        <tr>
                          <td className="py-2.5 px-2.5 text-center text-slate-600 uppercase text-[11px] font-sans">TOTAL</td>
                          <td className="py-2.5 px-3 text-slate-900 font-sans truncate">Summary ({sortedInspectorMembers.length} Members)</td>
                          {titheColumns.map(col => (
                            <td key={col.id} className="py-2.5 px-2.5 text-right font-bold" style={{ color: col.color || '#334155' }}>
                              ₹{((inspectorLedger.summary && (inspectorLedger.summary[col.field_key] ?? inspectorLedger.summary[`sum_${col.field_key}`])) || 0).toLocaleString('en-IN')}
                            </td>
                          ))}
                          <td className="py-2.5 px-3 text-right text-emerald-900 text-sm sm:text-base bg-emerald-100">₹{(inspectorLedger.summary.grand_total || 0).toLocaleString('en-IN')}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* VIEW MODE 2: CARDS VIEW - Responsive Mobile Layout */}
            {inspectorViewMode === 'card' && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {inspectorLoading ? (
                    <div className="col-span-2 py-10 text-center text-xs text-indigo-600 font-semibold animate-pulse bg-white rounded-2xl border border-slate-200">
                      Loading ledger...
                    </div>
                  ) : sortedInspectorMembers.length === 0 ? (
                    <div className="col-span-2 py-10 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                      No tithes recorded.
                    </div>
                  ) : (
                    ((!showAllInspectorCards && sortedInspectorMembers.length > 4)
                      ? sortedInspectorMembers.slice(0, 4)
                      : sortedInspectorMembers
                    ).map((m) => (
                      <div
                        key={m.member_id}
                        onClick={() => {
                          setSelectedMemberToEdit(m);
                          setShowMemberEditModal(true);
                        }}
                        className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-1.5 active:scale-[0.98]"
                        title="Click to edit member details and tithes"
                      >
                        {/* Top: Sl No & Member Name with Bial Name below */}
                        <div className="flex items-start justify-between gap-1 min-w-0">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <span className="w-4 h-4 mt-0.5 rounded-md bg-indigo-100 text-indigo-700 font-mono font-bold text-[9px] flex items-center justify-center shrink-0">
                              {m.sl_no}
                            </span>
                            <div className="min-w-0 flex flex-col items-start">
                              <span className="font-bold text-slate-900 text-xs leading-snug truncate">
                                {m.name}
                              </span>
                              {inspectorBialId === 'all' && m.bial_name && (
                                <span className="text-[9.5px] text-slate-500 font-medium truncate leading-tight">
                                  {m.bial_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTransferPreselectedMember(m);
                                setTransferPreselectedBialId(m.bial_id || inspectorBialId);
                                setShowTransferModal(true);
                              }}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title={`Transfer ${m.name} to another Bial`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            <Edit3 className="w-3 h-3 text-slate-400 opacity-70" />
                          </div>
                        </div>

                        {/* Category Breakdown (Dynamic mini grid) */}
                        <div className="grid grid-cols-2 gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100 text-[10px] font-mono">
                          {titheColumns.map(col => (
                            <div key={col.id} className="flex items-center justify-between" style={{ color: col.color || '#334155' }}>
                              <span className="font-bold text-slate-400">{col.code}:</span>
                              <span>₹{(m[col.field_key] || 0).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total Line */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                          <span className="text-[10px] font-extrabold text-slate-600 uppercase">Total:</span>
                          <span className="font-mono font-black text-emerald-700">₹{(m.total || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* More / Show Less Toggle Button */}
                {sortedInspectorMembers.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllInspectorCards(prev => !prev)}
                    className="w-full py-2 px-4 rounded-2xl bg-white hover:bg-slate-50 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {showAllInspectorCards ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-indigo-600" />
                        <span>Show Less (Collapse to 4 Members)</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 text-indigo-600" />
                        <span>More ({sortedInspectorMembers.length - 4} more Members)</span>
                      </>
                    )}
                  </button>
                )}

                {/* Monthly Ledger Summary Footer Card */}
                {inspectorLedger?.summary && sortedInspectorMembers.length > 0 && (
                  <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-3 rounded-2xl border border-indigo-700 text-white shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold border-b border-indigo-800 pb-1.5">
                      <span className="text-indigo-200 uppercase tracking-wider text-[10px]">Monthly Bial Total</span>
                      <span className="text-slate-300 font-sans text-[11px]">{sortedInspectorMembers.length} Members</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center font-mono text-[10px] pt-0.5">
                      {titheColumns.map(col => (
                        <div key={col.id} className="bg-indigo-950/60 p-1 rounded-lg border border-indigo-800/60">
                          <span className="text-[9px] block" style={{ color: col.color || '#93c5fd' }}>{col.code}</span>
                          <span className="font-bold">₹{((inspectorLedger.summary && (inspectorLedger.summary[col.field_key] ?? inspectorLedger.summary[`sum_${col.field_key}`])) || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-indigo-800 text-xs">
                      <span className="font-bold text-indigo-200">GRAND TOTAL:</span>
                      <span className="font-mono font-black text-emerald-300 text-sm">₹{(inspectorLedger.summary.grand_total || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TITHE HEADERS & COLUMNS */}
        {activeTab === 'columns' && (
          <div className="animate-in fade-in duration-150">
            <TitheColumnsTab
              onColumnsChanged={async (updatedCols) => {
                if (Array.isArray(updatedCols)) {
                  setTitheColumns(updatedCols);
                }
                await loadAdminData();
              }}
              showToast={showToast}
            />
          </div>
        )}

        {/* TAB 4: CROSS-BIAL ANALYTICS & RETURN STATS */}
        {activeTab === 'analytics' && stats && (
          <div className="space-y-3 animate-in fade-in duration-150">
            
            {/* KPI Features Grid: 2 features per line across all views */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              
              {/* Feature 1: Top Bial */}
              <div className="glass-panel p-2 sm:p-2.5 rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-500/10 via-indigo-500/5 to-white shadow-2xs flex flex-col justify-between space-y-1">
                {/* Header Box */}
                <div className="pb-1 border-b border-amber-200/60">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1 truncate">
                    <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">TOP BIAL</span>
                  </span>
                </div>

                {/* Data Box 1: Bial Name & under that the amount */}
                <div className="bg-white/90 p-1.5 sm:p-2 rounded-xl border border-amber-200/70 space-y-0.5">
                  <span className="text-xs sm:text-xs font-bold text-slate-900 block truncate">
                    {topContributingBial?.name || 'N/A'}
                  </span>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-xs sm:text-xs font-black text-indigo-700">
                      ₹{(topContributingBial?.total || 0).toLocaleString('en-IN')}
                    </span>
                    {topContributingBial && (
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-500">
                        ({topContributingBial.percentage_share}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Data Box 2: Return Rate - Bial return Rate: in one line and below that figures */}
                <div className="bg-slate-50/90 p-1.5 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-600 font-bold text-[8.5px] sm:text-[9.5px] block">
                    Bial return Rate:
                  </span>
                  <span className="font-mono font-black text-emerald-700 text-xs sm:text-xs block">
                    {topContributingBial ? `${topContributingBial.return_rate}% (${topContributingBial.returned_members}/${topContributingBial.total_members} HH)` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Feature 2: Households Returned */}
              <div className="glass-panel p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-1">
                {/* Header Box */}
                <div className="pb-1 border-b border-slate-100">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1 truncate">
                    <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">HOUSEHOLDS RETURNED</span>
                  </span>
                </div>

                {/* Data Box 1: Count & Progress */}
                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-baseline justify-between gap-1 font-mono">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs sm:text-xs font-black text-slate-900">
                        {totalReturnedMembers}
                      </span>
                      <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 font-sans">
                        / {totalSystemMembers} HH
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-indigo-700">
                      {overallReturnRate}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, overallReturnRate)}%` }}
                    />
                  </div>
                </div>

                {/* Data Box 2: Pending */}
                <div className="bg-slate-50/90 p-1.5 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-600 font-bold text-[8.5px] sm:text-[9.5px] block">
                    Pending Households:
                  </span>
                  <span className="font-mono font-black text-amber-600 text-xs sm:text-xs block">
                    {pendingMembers} HH
                  </span>
                </div>
              </div>

              {/* Feature 3: Overall Return Rate */}
              <div className="glass-panel p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-1">
                {/* Header Box */}
                <div className="pb-1 border-b border-slate-100">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1 truncate">
                    <Percent className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">OVERALL RETURN RATE</span>
                  </span>
                </div>

                {/* Data Box 1: Compliance Rate */}
                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200 space-y-1 font-mono">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-xs sm:text-xs font-black text-emerald-700">
                      {overallReturnRate}%
                    </span>
                    <span className="text-[8.5px] sm:text-[9px] font-bold text-slate-500 font-sans">
                      compliance
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, overallReturnRate)}%` }}
                    />
                  </div>
                </div>

                {/* Data Box 2: Total Tithes */}
                <div className="bg-slate-50/90 p-1.5 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-600 font-bold text-[8.5px] sm:text-[9.5px] block">
                    Total Church Tithes:
                  </span>
                  <span className="font-mono font-black text-slate-900 text-xs sm:text-xs block truncate">
                    ₹{grandTotalVal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Feature 4: Average Contribution per Returned Member */}
              <div className="glass-panel p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-1">
                {/* Header Box */}
                <div className="pb-1 border-b border-slate-100">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1 truncate">
                    <Wallet className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">AVG / HOUSEHOLD</span>
                  </span>
                </div>

                {/* Data Box 1: Avg Amount */}
                <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-slate-200 space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Average Tithe / Active HH</span>
                  <div className="text-xs sm:text-xs font-mono font-black text-purple-800">
                    ₹{avgContributionPerMember.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Data Box 2: Units */}
                <div className="bg-slate-50/90 p-1.5 rounded-xl border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-600 font-bold text-[8.5px] sm:text-[9.5px] block">
                    Reporting Units:
                  </span>
                  <span className="font-mono font-black text-slate-800 text-xs sm:text-xs block">
                    {enrichedBialBreakdown.length} Bials
                  </span>
                </div>
              </div>

            </div>

            {/* MONTH-OVER-MONTH PERFORMANCE COMPARISON (Current Month vs Previous Month) */}
            <div className="glass-panel p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-indigo-200/80 shadow-2xs space-y-3 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/60">
              
              {/* Header & Comparison Month Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <span>Month-over-Month Performance Comparison</span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                    Comparing <strong className="text-indigo-950 font-bold">Month A ({currMonthFullName})</strong> vs <strong className="text-slate-700 font-bold">Month B ({prevMonthFullName})</strong>
                  </p>
                </div>

                {/* Flexible Month A & Month B Comparison Selectors */}
                <div className="flex items-center gap-2 text-xs font-bold shrink-0 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs flex-wrap self-end sm:self-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-indigo-900 text-[10.5px] uppercase font-black tracking-tight">Month A :</span>
                    <select
                      value={compareMonthTarget}
                      onChange={(e) => setCompareMonthTarget(parseInt(e.target.value))}
                      className="bg-transparent font-extrabold text-indigo-950 focus:outline-none cursor-pointer text-xs"
                    >
                      {FINANCIAL_MONTH_ORDER.map(mNum => (
                        <option key={mNum} value={mNum}>{FINANCIAL_FULL_NAMES[mNum]}</option>
                      ))}
                    </select>
                  </div>

                  <span className="text-slate-400 text-xs font-black px-1">VS</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[10.5px] uppercase font-black tracking-tight">Month B :</span>
                    <select
                      value={compareMonthBase}
                      onChange={(e) => setCompareMonthBase(parseInt(e.target.value))}
                      className="bg-transparent font-extrabold text-slate-900 focus:outline-none cursor-pointer text-xs"
                    >
                      {FINANCIAL_MONTH_ORDER.map(mNum => (
                        <option key={mNum} value={mNum}>{FINANCIAL_FULL_NAMES[mNum]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Monetary and Household Return Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                
                {/* 1. Monetary Comparison Card */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Monetary Contribution</span>
                    </span>
                    {/* Growth Indicator */}
                    <span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold border flex items-center gap-1 ${
                      monetaryDiff >= 0 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {monetaryDiff >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownRight className="w-3 h-3 text-rose-600" />}
                      <span>{monetaryDiff >= 0 ? `+₹${monetaryDiff.toLocaleString('en-IN')} (+${monetaryDiffPercent}%)` : `-₹${Math.abs(monetaryDiff).toLocaleString('en-IN')} (${monetaryDiffPercent}%)`}</span>
                    </span>
                  </div>

                  {/* Previous vs Current Boxes */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono space-y-0.5">
                      <span className="text-[8.5px] font-bold text-slate-500 uppercase block font-sans">
                        {prevMonthLabel} (Previous)
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-700 block">
                        ₹{prevTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-200 text-center font-mono space-y-0.5">
                      <span className="text-[8.5px] font-bold text-indigo-700 uppercase block font-sans">
                        {currMonthLabel} (Current)
                      </span>
                      <span className="text-xs sm:text-sm font-black text-indigo-900 block">
                        ₹{currTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Category Breakdown Comparison Bars */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100 text-[10px]">
                    <div className="flex items-center justify-between text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                      <span>Category</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600">{prevMonthLabel}</span>
                        <span className="text-indigo-700">{currMonthLabel}</span>
                      </div>
                    </div>

                    {titheColumns.map((cat) => {
                      const prevVal = prevMonthTrend[cat.field_key] || 0;
                      const currVal = currMonthTrend[cat.field_key] || 0;
                      const maxVal = Math.max(1, prevVal, currVal);
                      return (
                        <div key={cat.id || cat.field_key} className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                          <div className="flex items-center justify-between font-mono font-bold text-[10px]">
                            <span className="text-slate-700 font-sans font-semibold truncate pr-2">
                              {cat.name} ({cat.code})
                            </span>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-slate-500">₹{prevVal.toLocaleString('en-IN')}</span>
                              <span className="text-indigo-700 font-black">₹{currVal.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                              <div className="bg-slate-400 h-1 rounded-full" style={{ width: `${(prevVal / maxVal) * 100}%` }} />
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                              <div className="h-1 rounded-full" style={{ backgroundColor: cat.color || '#6366f1', width: `${(currVal / maxVal) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Household Return Comparison Card */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Household Return Rate</span>
                    </span>
                    {/* Compliance Change Indicator */}
                    <span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold border flex items-center gap-1 ${
                      returnedDiff >= 0 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {returnedDiff >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownRight className="w-3 h-3 text-rose-600" />}
                      <span>{returnedDiff >= 0 ? `+${returnedDiff} HH (+${returnRateDiff}%)` : `${returnedDiff} HH (${returnRateDiff}%)`}</span>
                    </span>
                  </div>

                  {/* Previous vs Current Boxes */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono space-y-0.5">
                      <span className="text-[8.5px] font-bold text-slate-500 uppercase block font-sans">
                        {prevMonthLabel} (Previous)
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-700 block">
                        {prevReturned} <span className="text-[9px] font-sans text-slate-500 font-normal">/ {totalSystemMembers} HH</span>
                      </span>
                      <span className="text-[9.5px] font-bold text-slate-600 block">
                        {prevReturnRate}% compliance
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center font-mono space-y-0.5">
                      <span className="text-[8.5px] font-bold text-emerald-700 uppercase block font-sans">
                        {currMonthLabel} (Current)
                      </span>
                      <span className="text-xs sm:text-sm font-black text-emerald-900 block">
                        {currReturned} <span className="text-[9px] font-sans text-emerald-600 font-normal">/ {totalSystemMembers} HH</span>
                      </span>
                      <span className="text-[9.5px] font-bold text-emerald-700 block">
                        {currReturnRate}% compliance
                      </span>
                    </div>
                  </div>

                  {/* Dual Visual Progress Comparison */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-600 font-sans font-bold">{prevMonthFullName} Return Progress</span>
                        <span className="text-slate-700 font-bold">{prevReturnRate}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-slate-400 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, prevReturnRate)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-indigo-950 font-sans font-bold">{currMonthFullName} Return Progress</span>
                        <span className="text-emerald-700 font-black">{currReturnRate}%</span>
                      </div>
                      <div className="w-full bg-emerald-100/60 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, currReturnRate)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary Comparison Callout */}
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Compliance Shift:</span>
                    <span className={`font-mono font-bold ${returnRateDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {returnRateDiff >= 0 ? `+${returnRateDiff}% higher participation` : `${returnRateDiff}% lower participation`}
                    </span>
                  </div>

                </div>

              </div>

              {/* Grouped Comparison Bar Chart */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] sm:text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Category-wise Breakdown Comparison (₹)</span>
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-slate-400 inline-block" />
                      <span className="text-slate-600">{prevMonthLabel}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block" />
                      <span className="text-indigo-700">{currMonthLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="category" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }}
                        formatter={(val, name) => [`₹${Number(val).toLocaleString('en-IN')}`, name]}
                      />
                      <Bar dataKey={prevMonthLabel} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={currMonthLabel} fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* LEADERBOARD IN COMPACT CARD VIEW (1 feature per line) */}
            <div className="glass-panel p-2.5 sm:p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <h3 className="text-xs sm:text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  Leaderboard
                </h3>
                <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-[9px] sm:text-[10px] border border-indigo-100">
                  {enrichedBialBreakdown.length} Bials
                </span>
              </div>

              {/* Cards Grid: 1 per line */}
              <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                {enrichedBialBreakdown.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No Bial analytics data found.
                  </div>
                ) : (
                  enrichedBialBreakdown.map((b, idx) => {
                    const returnRate = b.return_rate || 0;
                    const rateColor = returnRate >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : returnRate >= 50 ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-amber-700 bg-amber-50 border-amber-200';
                    const barColor = returnRate >= 80 ? 'bg-emerald-500' : returnRate >= 50 ? 'bg-blue-500' : 'bg-amber-500';

                    return (
                      <div
                        key={b.id}
                        className={`p-2 rounded-xl border transition-all space-y-1.5 shadow-2xs ${
                          idx === 0 && b.total > 0
                            ? 'bg-gradient-to-br from-amber-500/10 via-indigo-50/50 to-white border-amber-300 shadow-xs'
                            : idx === 1 && b.total > 0
                            ? 'bg-gradient-to-br from-slate-100/80 via-white to-slate-50 border-slate-300'
                            : idx === 2 && b.total > 0
                            ? 'bg-gradient-to-br from-amber-700/10 via-white to-amber-50/40 border-amber-200'
                            : 'bg-white border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        {/* Line 1: Rank Badge, Bial Name, Code, and Share % */}
                        <div className="bg-white/90 p-1.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {idx === 0 && b.total > 0 ? (
                              <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 font-bold text-[9px] flex items-center justify-center border border-amber-300 shadow-2xs shrink-0">
                                👑
                              </span>
                            ) : idx === 1 && b.total > 0 ? (
                              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center border border-slate-300 shrink-0">
                                2
                              </span>
                            ) : idx === 2 && b.total > 0 ? (
                              <span className="w-4 h-4 rounded-full bg-amber-700/20 text-amber-900 font-bold text-[9px] flex items-center justify-center border border-amber-600/30 shrink-0">
                                3
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 font-mono font-bold text-[9px] flex items-center justify-center border border-slate-200 shrink-0">
                                {idx + 1}
                              </span>
                            )}

                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-[11px] sm:text-xs truncate">
                                {b.name}
                              </h4>
                              {b.code && (
                                <span className="text-[7.5px] sm:text-[8.5px] font-mono text-slate-500 block truncate">
                                  Code: {b.code}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Share Badge */}
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[8px] sm:text-[8.5px] border border-indigo-100 shrink-0">
                            {b.percentage_share || 0}% share
                          </span>
                        </div>

                        {/* Line 2: Side-by-Side Monetary Breakdown */}
                        <div className="grid grid-cols-2 gap-1">
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-center font-mono">
                            <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-500 uppercase block font-sans">Total Tithe</span>
                            <span className="font-black text-[11px] sm:text-xs text-slate-900">
                              ₹{(b.total || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-center font-mono">
                            <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-500 uppercase block font-sans">Avg / Household</span>
                            <span className="font-black text-[11px] sm:text-xs text-slate-800">
                              ₹{(b.avg_per_member || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {/* Line 3: Households Returned & Return Rate Meter */}
                        <div className="bg-slate-50/90 p-1.5 rounded-lg border border-slate-200/80 space-y-0.5">
                          <div className="flex items-center justify-between text-[8.5px] sm:text-[9px]">
                            <span className="text-slate-600 font-medium truncate">
                              Households: <strong className="text-indigo-700 font-mono">{b.returned_members || 0}</strong>/{b.total_members || 0} HH
                            </span>
                            <span className={`px-1 py-0.2 rounded text-[8px] sm:text-[8.5px] font-mono font-bold border shrink-0 ${rateColor}`}>
                              {returnRate}% return
                            </span>
                          </div>
                          <div className="w-full bg-slate-200/80 rounded-full h-1 overflow-hidden">
                            <div
                              className={`${barColor} h-1 rounded-full transition-all duration-500`}
                              style={{ width: `${Math.min(100, returnRate)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              
              {/* Bar Chart: Monetary Contributions by Bial */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs">
                <div className="mb-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Monetary Contributions by Bial
                  </h3>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={enrichedBialBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="code" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }}
                        formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Total Collected']}
                        labelFormatter={(label, items) => {
                          const item = items?.[0]?.payload;
                          return item ? `${item.name} (${item.code})` : label;
                        }}
                      />
                      <Bar dataKey="total" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart: Category Allocation Ratio */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs">
                <div className="mb-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-emerald-600" />
                    Category Allocation Ratio
                  </h3>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="45%" innerRadius={40} outerRadius={68} paddingAngle={4} dataKey="value">
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '11px' }}
                        formatter={(val) => [`₹${val.toLocaleString('en-IN')}`]}
                      />
                      <Legend wrapperStyle={{ color: '#475569', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: DATA BACKUP & RESTORE */}
        {activeTab === 'backups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-150">
            <div className="glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                  <Download className="w-4 h-4 text-indigo-600" /> Instant System Snapshot Backup
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Initiate a full manual snapshot backup JSON download containing all Bials, members, monthly tithe records, and lock settings.
                </p>
              </div>
              <button onClick={handleBackupNow} className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Download className="w-4 h-4" /> Download Backup Snapshot Now
              </button>
            </div>

            <div className="glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                  <Upload className="w-4 h-4 text-emerald-600" /> Restore System Snapshot
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Upload a valid JSON database snapshot file to restore system data.
                </p>

                <form onSubmit={handleRestoreSubmit} className="space-y-3">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors bg-slate-50">
                    <input type="file" accept=".json" onChange={(e) => setSelectedFile(e.target.files[0])} className="hidden" id="admin-backup-upload" />
                    <label htmlFor="admin-backup-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">{selectedFile ? selectedFile.name : 'Select backup JSON snapshot'}</span>
                    </label>
                  </div>
                  <button type="submit" disabled={!selectedFile || restoring} className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer">
                    {restoring ? 'Restoring Database...' : 'Restore Database'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Modals */}
      <BialModal
        isOpen={showBialModal}
        onClose={() => setShowBialModal(false)}
        onSave={handleSaveBial}
        bialToEdit={bialToEdit}
      />

      <BialCredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
        bials={bials}
        onRefresh={loadAdminData}
        onEditBial={(b) => {
          setBialToEdit(b);
          setShowBialModal(true);
        }}
        onAddNewBial={() => {
          setBialToEdit(null);
          setShowBialModal(true);
        }}
        showToast={showToast}
      />

      <MonthMatrixModal
        isOpen={showMatrixModal}
        onClose={() => setShowMatrixModal(false)}
        currentYear={year}
        showToast={showToast}
      />

      <FinancialYearModal
        isOpen={showYearModal}
        onClose={() => setShowYearModal(false)}
        years={financialYears}
        activeYear={activeYear}
        onYearsUpdated={loadFinancialYears}
        showToast={showToast}
      />

      {/* 1. Previous Consolidated Report & Overall Member Ledger Modal */}
      <Modal isOpen={showConsolidatedModal} onClose={() => setShowConsolidatedModal(false)} maxWidth="max-w-md">
        <Modal.Header
          title={`Consolidated Reports & Overall Ledger - FY ${year}`}
          subtitle="Select consolidated summary or overall member summation"
          icon={FileSpreadsheet}
          onClose={() => setShowConsolidatedModal(false)}
        />
        <Modal.Body className="space-y-3.5">
          {/* Section 1: Consolidated Bial Totals */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1. Consolidated Summary (All Bials Totals)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  exportAdminConsolidatedExcel({ year, grandTotals, bialBreakdown: stats?.bialBreakdown || [] });
                  setShowConsolidatedModal(false);
                  showToast('Excel report downloaded', 'success');
                }}
                className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => {
                  exportAdminConsolidatedPDF({ year, grandTotals, bialBreakdown: stats?.bialBreakdown || [] });
                  setShowConsolidatedModal(false);
                  showToast('PDF report downloaded', 'success');
                }}
                className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>PDF (.pdf)</span>
              </button>
            </div>
          </div>

          {/* Section 2: Overall Member Contributions (Annual Summation for each member sorted Bial 1...) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">
                2. Overall Member-by-Member Ledger
              </span>
              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                Sorted Bial 1...
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Full annual summation of PTR, RT, Tch, Bldg and overall total for each member across all Bials.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={() => handleExportOverall('excel')}
                className="p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Overall Excel</span>
              </button>

              <button
                onClick={() => handleExportOverall('pdf')}
                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Overall PDF</span>
              </button>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setShowConsolidatedModal(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </Modal.Footer>
      </Modal>

      {/* 2. Official Church Certificate & Report Form Generator Modal */}
      <OfficialReportModal
        isOpen={showReportFormModal}
        onClose={() => setShowReportFormModal(false)}
        currentYear={year}
        financialYears={financialYears}
        bials={bials}
        grandTotals={grandTotals}
        stats={stats}
        user={user}
        showToast={showToast}
      />

      {/* Inspector (Bial Ledger) Export Dialog */}
      <Modal isOpen={showInspectorExportModal} onClose={() => setShowInspectorExportModal(false)} maxWidth="max-w-md">
        <Modal.Header
          title={`${selectedBialObj?.name || 'Bial'} - Export Ledger`}
          subtitle={`${FINANCIAL_MONTHS.find(m => m.id === inspectorMonth)?.name || ''} FY ${year}`}
          icon={FileText}
          onClose={() => setShowInspectorExportModal(false)}
        />
        <Modal.Body className="space-y-3.5">
          {/* Section 1: Monthly Ledger for Selected Bial */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1. This Month Bial Ledger ({selectedBialObj?.name})
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  exportToExcel({
                    bialName: selectedBialObj ? selectedBialObj.name : 'Bial',
                    year,
                    month: inspectorMonth,
                    members: sortedInspectorMembers,
                    summary: inspectorLedger?.summary || {},
                    columns: titheColumns
                  });
                  setShowInspectorExportModal(false);
                  showToast('Excel ledger downloaded', 'success');
                }}
                className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => {
                  exportToPDF({
                    bialName: selectedBialObj ? selectedBialObj.name : 'Bial',
                    year,
                    month: inspectorMonth,
                    members: sortedInspectorMembers,
                    summary: inspectorLedger?.summary || {},
                    columns: titheColumns
                  });
                  setShowInspectorExportModal(false);
                  showToast('PDF ledger downloaded', 'success');
                }}
                className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>PDF (.pdf)</span>
              </button>
            </div>
          </div>

          {/* Section 2: Overall Member Contributions (Annual Summation for all Bials) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">
                2. Overall Member-by-Member Ledger
              </span>
              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                Sorted Bial 1...
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Full annual summation of PTR, RT, Tch, Bldg and overall total for each member across all Bials.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={() => handleExportOverall('excel')}
                className="p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Overall Excel</span>
              </button>

              <button
                onClick={() => handleExportOverall('pdf')}
                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Overall PDF</span>
              </button>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setShowInspectorExportModal(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </Modal.Footer>
      </Modal>

      {/* Admin Member & Tithe Edit Modal */}
      <AdminMemberEditModal
        isOpen={showMemberEditModal}
        onClose={() => {
          setShowMemberEditModal(false);
          setSelectedMemberToEdit(null);
        }}
        member={selectedMemberToEdit}
        bial={selectedBialObj}
        year={year}
        month={inspectorMonth}
        columns={titheColumns}
        onSaved={() => {
          loadInspectorLedger();
          loadAdminData();
        }}
        onTransferClick={(m) => {
          setTransferPreselectedMember(m);
          setTransferPreselectedBialId(inspectorBialId || (selectedBialObj && selectedBialObj.id));
          setShowTransferModal(true);
        }}
        showToast={showToast}
      />

      {/* Manage Contribution Columns Modal */}
      <ManageColumnsModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        onColumnsUpdated={() => {
          loadAdminData();
          loadInspectorLedger();
        }}
      />

      {/* Admin Member Transfer Modal */}
      <MemberTransferModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setTransferPreselectedMember(null);
          setTransferPreselectedBialId(null);
        }}
        bials={bials}
        preselectedMember={transferPreselectedMember}
        preselectedBialId={transferPreselectedBialId}
        onTransferred={() => {
          loadAdminData();
          loadInspectorLedger();
        }}
        showToast={showToast}
      />

      {/* Admin Member Rollover Modal */}
      <MemberRolloverModal
        isOpen={showRolloverModal}
        onClose={() => setShowRolloverModal(false)}
        currentYear={year}
        financialYears={financialYears}
        bialId={inspectorBialId || 'all'}
        bialName={inspectorBialId === 'all' ? 'All Bials' : selectedBialObj?.name}
        onSuccess={(newYear) => {
          if (newYear) setYear(newYear);
          loadAdminData();
          loadInspectorLedger();
        }}
        showToast={showToast}
      />

    </div>
  );
}


