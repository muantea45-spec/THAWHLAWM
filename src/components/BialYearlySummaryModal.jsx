import React, { useState, useEffect } from 'react';
import {
  Calendar, Layers, Users, Search, ArrowUp, ArrowDown, ArrowUpDown,
  Eye, LayoutGrid, Table, History, CheckCircle2, AlertCircle, CalendarCheck
} from 'lucide-react';
import Modal from './common/Modal';
import { api } from '../utils/api';
import { DEFAULT_TITHE_COLUMNS, FINANCIAL_MONTHS } from '../utils/constants';

export default function BialYearlySummaryModal({
  isOpen,
  onClose,
  bialId,
  initialYear,
  initialTab = 'history',
  showToast,
  onSelectMember
}) {
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [financialYears, setFinancialYears] = useState([2024, 2025, 2026, 2027]);
  const [activeTab, setActiveTab] = useState(initialTab || 'history'); // 'history' | 'monthly' | 'members'
  const [viewLayout, setViewLayout] = useState('cards'); // 'cards' only
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Search & Sorting state for Members and History tab
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'full' | 'partial' | 'unpaid'
  const [historySort, setHistorySort] = useState('sl_no_asc'); // 'sl_no_asc' | 'sl_no_desc' | 'total_desc' | 'name_asc'
  const [sortField, setSortField] = useState('sl_no');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    api.getFinancialYears()
      .then(years => {
        if (years && years.length > 0) setFinancialYears(years);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen && bialId) {
      fetchSummary();
    }
  }, [isOpen, bialId, year]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.getYearlySummary(bialId, year);
      setData(res);
    } catch (err) {
      showToast(err.message || 'Failed to load Bial aggregated collection summary', 'error');
    } finally {
      setLoading(false);
    }
  };

  const bial = data?.bial;
  const monthly = data?.monthlyBreakdown || [];
  const members = data?.memberTotals || [];
  const grand = data?.grandTotals || {};
  const activeCols = (data?.columns && data.columns.length > 0) ? data.columns : DEFAULT_TITHE_COLUMNS;

  // History Statistics
  const totalHouseholds = members.length;
  const fullyPaidCount = members.filter(m => {
    const paidMonths = FINANCIAL_MONTHS.filter(fm => (m.monthly?.[fm.id]?.total || 0) > 0);
    return paidMonths.length === 12;
  }).length;
  const unpaidCount = members.filter(m => {
    const paidMonths = FINANCIAL_MONTHS.filter(fm => (m.monthly?.[fm.id]?.total || 0) > 0);
    return paidMonths.length === 0;
  }).length;
  const partialCount = Math.max(0, totalHouseholds - fullyPaidCount - unpaidCount);

  // Filtered and Sorted Members for Household History Card View
  let processedHistoryMembers = members.filter(m => {
    const matchesSearch = !searchQuery.trim() ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(m.sl_no).includes(searchQuery);
    if (!matchesSearch) return false;

    const paidMonths = FINANCIAL_MONTHS.filter(fm => (m.monthly?.[fm.id]?.total || 0) > 0);
    const paidCount = paidMonths.length;

    if (historyFilter === 'full') return paidCount === 12;
    if (historyFilter === 'partial') return paidCount > 0 && paidCount < 12;
    if (historyFilter === 'unpaid') return paidCount === 0;
    return true;
  });

  processedHistoryMembers.sort((a, b) => {
    if (historySort === 'sl_no_asc') return (a.sl_no || 0) - (b.sl_no || 0);
    if (historySort === 'sl_no_desc') return (b.sl_no || 0) - (a.sl_no || 0);
    if (historySort === 'total_desc') return (b.grand_total || 0) - (a.grand_total || 0);
    if (historySort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    return 0;
  });

  // Sort Members for Tab 3 (Annual Totals)
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100 inline ml-0.5" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-400 font-bold inline ml-0.5" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400 font-bold inline ml-0.5" />
    );
  };

  let processedMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(m.sl_no).includes(searchQuery)
  );

  processedMembers.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-6xl">
      <Modal.Header
        title="Overall Collection Summary"
        subtitle={bial ? `${bial.name} • FY ${year}` : `FY ${year}`}
        icon={Layers}
        onClose={onClose}
      />

      <Modal.Body className="space-y-3.5">
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
            {activeCols.map(col => (
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
                <div className="font-mono text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  ₹{(grand[col.field_key] || grand[`total_${col.field_key}`] || 0).toLocaleString('en-IN')}
                </div>
              </div>
            ))}

            <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-2 sm:p-2.5 rounded-xl border border-indigo-700 text-white shadow-xs flex flex-col justify-between">
              <span className="text-[9px] sm:text-[10px] font-extrabold text-indigo-200 uppercase tracking-wider block">TOTAL</span>
              <div className="font-mono text-xs sm:text-sm font-black text-emerald-300 truncate">
                ₹{(grand.grand_total || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}

        {/* Top Control & Tab Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Household History ({members.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Monthly Breakdown</span>
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Annual Totals</span>
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(activeTab === 'history' || activeTab === 'members') && (
              <div className="relative w-40 sm:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search household..."
                  className="w-full pl-9 pr-3 py-1 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 shadow-2xs"
                />
              </div>
            )}

            {activeTab === 'history' && (
              <select
                value={historySort}
                onChange={(e) => setHistorySort(e.target.value)}
                className="text-xs font-bold px-2 py-1 rounded-xl bg-white border border-slate-300 text-slate-800 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                title="Sort households"
              >
                <option value="sl_no_asc">Sl No (1 → {totalHouseholds})</option>
                <option value="sl_no_desc">Sl No (Desc)</option>
                <option value="total_desc">Total (Highest)</option>
                <option value="name_asc">Name (A → Z)</option>
              </select>
            )}

            <div className="flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200 text-indigo-700 font-bold text-xs">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card View</span>
            </div>
          </div>
        </div>

        {/* Filter Strip for Household History */}
        {activeTab === 'history' && (
          <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setHistoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === 'all'
                    ? 'bg-white text-indigo-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalHouseholds})
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter('full')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === 'full'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-100/60'
                }`}
              >
                Paid All 12 Months ({fullyPaidCount})
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter('partial')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === 'partial'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-700 hover:bg-amber-100/60'
                }`}
              >
                Partial ({partialCount})
              </button>

              <button
                type="button"
                onClick={() => setHistoryFilter('unpaid')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  historyFilter === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-100/60'
                }`}
              >
                Unpaid ({unpaidCount})
              </button>
            </div>

            <span className="text-[11px] font-semibold text-slate-500">
              Showing <strong className="text-slate-900">{processedHistoryMembers.length}</strong> households
            </span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-indigo-600 font-bold text-xs animate-pulse">
            Loading summary data...
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No data available.
          </div>
        ) : activeTab === 'history' ? (
          <div className="space-y-3">
            {processedHistoryMembers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                No households found matching your search and filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[50vh] overflow-y-auto pr-1">
                {processedHistoryMembers.map(m => {
                  const paidMonths = FINANCIAL_MONTHS.filter(fm => (m.monthly?.[fm.id]?.total || 0) > 0);
                  const paidCount = paidMonths.length;
                  const isFullyPaid = paidCount === 12;
                  const isUnpaid = paidCount === 0;

                  return (
                    <div
                      key={m.member_id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between space-y-2.5"
                    >
                      {/* Card Header: Sl No, Household Name, and Grand Total */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {m.sl_no}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-heading font-black text-xs sm:text-sm text-slate-900 truncate leading-tight">
                              {m.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isFullyPaid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 12/12 Thla Pe Kim
                                </span>
                              ) : isUnpaid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" /> Pe Lo (0/12)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                  <CalendarCheck className="w-3 h-3 text-indigo-600" /> {paidCount}/12 Thla Pe
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs sm:text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg block tabular-nums">
                            ₹{(m.grand_total || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
                            Total
                          </span>
                        </div>
                      </div>

                      {/* 12-Month Matrix: Card View of every month's payments */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Thla Tin Thawh Dan</span>
                          <span className="text-slate-400 font-mono text-[9.5px]">FY {year}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-1 text-center">
                          {FINANCIAL_MONTHS.map(fm => {
                            const monthData = m.monthly?.[fm.id];
                            const amount = monthData?.total || 0;
                            const hasPaid = amount > 0;

                            return (
                              <div
                                key={fm.id}
                                className={`py-1 px-1 rounded-xl border text-center flex flex-col justify-between transition-colors ${
                                  hasPaid
                                    ? 'bg-emerald-50/70 border-emerald-200/80 shadow-2xs'
                                    : 'bg-slate-50/70 border-slate-200/50'
                                }`}
                                title={`${fm.name}: ₹${amount.toLocaleString('en-IN')}`}
                              >
                                <span className={`text-[9.5px] font-bold uppercase tracking-wider block leading-none ${
                                  hasPaid ? 'text-emerald-900' : 'text-slate-400'
                                }`}>
                                  {fm.short}
                                </span>
                                <span className={`font-mono text-[10px] sm:text-[10.5px] font-extrabold truncate block mt-0.5 tabular-nums ${
                                  hasPaid ? 'text-emerald-800' : 'text-slate-300'
                                }`}>
                                  {hasPaid ? `₹${amount.toLocaleString('en-IN')}` : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer: Category breakdown & details view button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap text-[10.5px]">
                        <div className="flex items-center gap-1 flex-wrap min-w-0">
                          {activeCols.map(col => {
                            const val = m[col.field_key] || m[`total_${col.field_key}`] || 0;
                            return (
                              <span
                                key={col.id}
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded-md border text-slate-700 bg-slate-50"
                                style={{ borderColor: `${col.color || '#6366f1'}30` }}
                              >
                                <strong style={{ color: col.color || '#4f46e5' }}>{col.code}:</strong> ₹{val.toLocaleString('en-IN')}
                              </span>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectMember && onSelectMember(m.member_id)}
                          className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-auto"
                          title="View full ledger for this member"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'monthly' ? (
          viewLayout === 'table' ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-[45vh]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 uppercase tracking-wider text-[11px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Month</th>
                      {activeCols.map(col => (
                        <th key={col.id} className="py-3 px-4 text-right" style={{ color: col.color || undefined }}>
                          {col.code}
                        </th>
                      ))}
                      <th className="py-3 px-4 text-right text-emerald-700 font-extrabold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {monthly.map((m) => (
                      <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-sans font-bold text-slate-900">{m.month_name}</td>
                        {activeCols.map(col => (
                          <td key={col.id} className="py-2.5 px-4 text-right" style={{ color: col.color || '#334155' }}>
                            ₹{(m[col.field_key] || 0).toLocaleString('en-IN')}
                          </td>
                        ))}
                        <td className="py-2.5 px-4 text-right font-extrabold text-emerald-800 bg-emerald-50">₹{(m.total || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[45vh] overflow-y-auto pr-1">
              {monthly.map((m) => (
                <div key={m.month} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-400 transition-all space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-xs text-slate-900">{m.month_name} {year}</span>
                    <span className="font-mono font-black text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      ₹{(m.total || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    {activeCols.map(col => (
                      <div 
                        key={col.id} 
                        className="p-1.5 rounded-xl border flex items-center justify-between"
                        style={{
                          backgroundColor: `${col.color || '#6366f1'}10`,
                          borderColor: `${col.color || '#6366f1'}25`
                        }}
                      >
                        <span className="text-[9.5px] font-extrabold uppercase truncate" style={{ color: col.color || '#1e293b' }}>
                          {col.code}
                        </span>
                        <span className="font-bold text-slate-900">₹{(m[col.field_key] || 0).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          viewLayout === 'table' ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-[45vh]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 uppercase tracking-wider text-[11px] font-bold">
                    <tr>
                      <th onClick={() => handleSort('sl_no')} className="py-3 px-3 text-center cursor-pointer hover:text-indigo-600">
                        Sl {getSortIcon('sl_no')}
                      </th>
                      <th onClick={() => handleSort('name')} className="py-3 px-4 cursor-pointer hover:text-indigo-600">
                        Member Name {getSortIcon('name')}
                      </th>
                      {activeCols.map(col => (
                        <th 
                          key={col.id} 
                          onClick={() => handleSort(col.field_key)} 
                          className="py-3 px-4 text-right cursor-pointer hover:text-indigo-600"
                          style={{ color: col.color || undefined }}
                        >
                          {col.code} {getSortIcon(col.field_key)}
                        </th>
                      ))}
                      <th onClick={() => handleSort('grand_total')} className="py-3 px-4 text-right text-emerald-700 font-extrabold cursor-pointer hover:text-indigo-600">
                        TOTAL {getSortIcon('grand_total')}
                      </th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {processedMembers.map((m) => (
                      <tr key={m.member_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-bold">{m.sl_no}</td>
                        <td className="py-2.5 px-4 font-sans font-bold text-slate-900">{m.name}</td>
                        {activeCols.map(col => {
                          const val = m[col.field_key] || m[`total_${col.field_key}`] || 0;
                          return (
                            <td key={col.id} className="py-2.5 px-4 text-right" style={{ color: col.color || '#334155' }}>
                              ₹{val.toLocaleString('en-IN')}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-4 text-right font-extrabold text-emerald-800 bg-emerald-50">₹{(m.grand_total || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onSelectMember && onSelectMember(m.member_id)}
                            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-sans font-bold border border-indigo-200 inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[45vh] overflow-y-auto pr-1">
              {processedMembers.map((m) => (
                <div key={m.member_id} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-400 transition-all space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {m.sl_no}
                      </span>
                      <span className="font-bold text-xs text-slate-900 truncate">{m.name}</span>
                    </div>
                    <button
                      onClick={() => onSelectMember && onSelectMember(m.member_id)}
                      className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="View Member History"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    {activeCols.map(col => {
                      const val = m[col.field_key] || m[`total_${col.field_key}`] || 0;
                      return (
                        <div 
                          key={col.id} 
                          className="p-1.5 rounded-xl border flex items-center justify-between"
                          style={{
                            backgroundColor: `${col.color || '#6366f1'}10`,
                            borderColor: `${col.color || '#6366f1'}25`
                          }}
                        >
                          <span className="text-[9.5px] font-extrabold uppercase truncate" style={{ color: col.color || '#1e293b' }}>
                            {col.code}
                          </span>
                          <span className="font-bold text-slate-900">₹{val.toLocaleString('en-IN')}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[9.5px] font-extrabold text-slate-500 uppercase">ANNUAL TOTAL</span>
                    <span className="font-mono font-black text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      ₹{(m.grand_total || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
        >
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
}
