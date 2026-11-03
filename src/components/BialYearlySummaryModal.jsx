import React, { useState, useEffect } from 'react';
import { Calendar, Layers, Users, FileText, Search, ArrowUp, ArrowDown, ArrowUpDown, Eye, LayoutGrid, Table } from 'lucide-react';
import Modal from './common/Modal';
import { api } from '../utils/api';
import { exportBialYearlySummaryPDF } from '../utils/exportEngine';
import { DEFAULT_TITHE_COLUMNS } from '../utils/constants';

export default function BialYearlySummaryModal({ isOpen, onClose, bialId, initialYear, showToast, onSelectMember }) {
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [financialYears, setFinancialYears] = useState([2024, 2025, 2026, 2027]);
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'members'
  const [viewLayout, setViewLayout] = useState('cards'); // 'cards' only
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Search & Sorting state for Members tab
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('sl_no');
  const [sortDirection, setSortDirection] = useState('asc');

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

  // Sort Members
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
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-5xl">
      <Modal.Header
        title="Overall Collection Summary"
        subtitle={bial ? `${bial.name} • FY ${year}` : `FY ${year}`}
        icon={Layers}
        onClose={onClose}
      />

      <Modal.Body className="space-y-4">
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Members ({members.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {activeTab === 'members' && (
              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search member..."
                  className="w-full pl-9 pr-3 py-1 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 shadow-xs"
                />
              </div>
            )}

            <div className="flex items-center bg-indigo-50 px-2 py-1 rounded-xl border border-indigo-200 text-indigo-700 font-bold text-xs">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card View</span>
            </div>

            {data && (
              <button
                onClick={() => exportBialYearlySummaryPDF({
                  bialName: bial?.name || 'Bial',
                  year,
                  columns: activeCols,
                  monthlyBreakdown: monthly,
                  memberTotals: members,
                  grandTotals: grand
                })}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-300 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" /> PDF
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-indigo-600 font-bold text-xs animate-pulse">
            Loading summary data...
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No data available.
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
