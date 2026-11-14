import React, { useState, useEffect } from 'react';
import {
  Calendar,
  User,
  FileText,
  Lock,
  Unlock,
  Check,
  X,
  LayoutGrid,
  Table as TableIcon,
  Loader2,
  TrendingUp,
  Percent,
  CheckCircle2,
  CalendarCheck,
  Info
} from 'lucide-react';
import { api } from '../utils/api';
import { exportMemberHistoryPDF } from '../utils/exportEngine';
import { DEFAULT_TITHE_COLUMNS } from '../utils/constants';
import Modal from './common/Modal';

export default function MemberHistoryModal({
  isOpen,
  onClose,
  memberId,
  initialYear,
  showToast,
  onUpdate,
  canExport = true
}) {
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [financialYears, setFinancialYears] = useState([2024, 2025, 2026, 2027]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewLayout, setViewLayout] = useState('table'); // 'table' | 'cards'

  // Month editing state
  const [editingMonth, setEditingMonth] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.getFinancialYears()
      .then(years => {
        if (years && years.length > 0) setFinancialYears(years);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen && memberId) {
      setEditingMonth(null);
      fetchMemberHistory();
    }
  }, [isOpen, memberId, year]);

  const fetchMemberHistory = async () => {
    try {
      setLoading(true);
      const res = await api.getMemberHistory(memberId, year);
      setData(res);
    } catch (err) {
      if (showToast) {
        showToast(err.message || 'Failed to load member payment history', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const member = data?.member;
  const annual = data?.annualSummary || {};
  const entries = data?.monthlyEntries || [];
  const activeCols = (data?.columns && data.columns.length > 0) ? data.columns : DEFAULT_TITHE_COLUMNS;

  const monthsReturnedCount = entries.filter(e => Number(e.total) > 0).length;
  const returnRatePercent = Math.round((monthsReturnedCount / 12) * 100);
  const avgMonthly = monthsReturnedCount > 0 ? Math.round((Number(annual.grand_total) || 0) / monthsReturnedCount) : 0;

  // Start editing a specific month on click
  const startEditing = (entry) => {
    if (entry.is_locked === 1) {
      if (showToast) {
        showToast('This month is locked by Admin. Edits are restricted.', 'error');
      }
      return;
    }
    setEditingMonth(entry.month);
    const draft = {};
    activeCols.forEach(col => {
      const v = entry[col.field_key];
      draft[col.field_key] = (v !== undefined && v !== null && Number(v) > 0) ? String(v) : '';
    });
    setEditDraft(draft);
  };

  // Cancel current editing
  const cancelEditing = () => {
    setEditingMonth(null);
    setEditDraft({});
  };

  // Draft input handler (numeric only)
  const handleDraftChange = (field, val) => {
    if (val === '' || /^\d*(\.\d{0,2})?$/.test(val)) {
      setEditDraft(prev => ({ ...prev, [field]: val }));
    }
  };

  // Live total for the month currently being edited
  const liveEditTotal = activeCols.reduce((sum, col) => sum + (parseFloat(editDraft[col.field_key]) || 0), 0);

  // Keydown handler for saving with Enter key or canceling with Escape key
  const handleKeyDown = (e, monthNum) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(monthNum);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  // Save the edited month contribution
  const handleSaveEdit = async (monthNum) => {
    if (!member) return;

    const payload = {
      member_id: member.id,
      year,
      month: monthNum,
      bial_id: member.bial_id
    };

    let monthTotal = 0;
    activeCols.forEach(col => {
      const val = parseFloat(editDraft[col.field_key]) || 0;
      payload[col.field_key] = val;
      monthTotal += val;
    });

    try {
      setIsSaving(true);
      await api.saveTithe(payload);

      // Update local state entries
      const updatedEntries = (data.monthlyEntries || []).map(entry => {
        if (entry.month === monthNum) {
          const updated = {
            ...entry,
            total: monthTotal
          };
          activeCols.forEach(col => {
            updated[col.field_key] = payload[col.field_key];
          });
          return updated;
        }
        return entry;
      });

      // Recalculate annual summary dynamically
      const updatedAnnual = {
        grand_total: updatedEntries.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)
      };
      activeCols.forEach(col => {
        const sum = updatedEntries.reduce((acc, curr) => acc + (Number(curr[col.field_key]) || 0), 0);
        updatedAnnual[col.field_key] = sum;
        updatedAnnual[`total_${col.field_key}`] = sum;
      });

      setData(prev => ({
        ...prev,
        monthlyEntries: updatedEntries,
        annualSummary: updatedAnnual
      }));

      const monthObj = entries.find(e => e.month === monthNum);
      const mName = monthObj ? monthObj.month_name : `Month ${monthNum}`;

      if (showToast) {
        showToast(`${mName} contribution updated successfully!`, 'success');
      }

      setEditingMonth(null);

      // Notify parent component if callback provided (e.g. BialDashboard loadLedger)
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      if (showToast) {
        showToast(err.message || 'Failed to save month contribution', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-5xl">
      <Modal.Header
        title={member ? member.name : 'Member History'}
        subtitle={member ? `Sl No: #${member.sl_no} • ${member.bial_name}` : 'Statement Overview'}
        icon={User}
        onClose={onClose}
      />

      {/* SUB-HEADER TOOLBAR: Financial Year, View Mode Switcher, PDF Export */}
      <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Financial Year Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-bold text-slate-700">Financial Year:</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-white border border-slate-300 text-slate-900 font-mono font-bold px-2.5 py-1 rounded-lg text-xs focus:outline-none focus:border-indigo-600 shadow-2xs"
          >
            {financialYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Right: Layout Switcher & PDF Action */}
        <div className="flex items-center gap-2">
          {/* View Switcher: Table View vs Card View */}
          <div className="flex items-center bg-slate-200/90 p-0.5 rounded-xl border border-slate-300/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                cancelEditing();
                setViewLayout('table');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewLayout === 'table'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Table View</span>
            </button>
            <button
              type="button"
              onClick={() => {
                cancelEditing();
                setViewLayout('cards');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewLayout === 'cards'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Card View</span>
            </button>
          </div>

          {/* PDF Export Button */}
          {canExport && data && (
            <button
              onClick={() => exportMemberHistoryPDF(data)}
              className="px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Download PDF Statement"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" /> PDF
            </button>
          )}
        </div>
      </div>

      <Modal.Body className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-indigo-600 font-bold animate-pulse text-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Loading payment history...</span>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No data available.
          </div>
        ) : (
          <>
            {/* HOUSEHOLD RETURN COMPLIANCE & CONTRIBUTION HIGHLIGHT */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white shadow-md border border-indigo-900/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-3 pb-3 border-b border-indigo-800/40">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">
                    Household 12-Month Performance ({year})
                  </span>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    {member?.name || 'Household'}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-800/80 text-indigo-200 border border-indigo-600/40">
                      Sl No: #{member?.sl_no}
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300 font-medium">Bial:</span>
                  <span className="font-bold text-amber-300">{member?.bial_name || 'Assigned Bial'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                {/* Metric 1: Months Returned */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center justify-center gap-1">
                    <CalendarCheck className="w-3 h-3 text-indigo-300" /> Months Returned
                  </span>
                  <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5">
                    {monthsReturnedCount} <span className="text-xs font-normal text-slate-300">/ 12</span>
                  </div>
                  <div className="w-full bg-white/20 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(monthsReturnedCount / 12) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Metric 2: Compliance Rate */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center justify-center gap-1">
                    <Percent className="w-3 h-3 text-emerald-300" /> Return Rate
                  </span>
                  <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${returnRatePercent >= 75 ? 'text-emerald-300' : returnRatePercent >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
                    {returnRatePercent}%
                  </div>
                  <span className="text-[10px] text-slate-300 truncate">
                    {returnRatePercent === 100 ? '⭐ Perfect Record' : returnRatePercent >= 75 ? 'High Regularity' : 'Partial Returns'}
                  </span>
                </div>

                {/* Metric 3: Average Contribution */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center justify-center gap-1">
                    <TrendingUp className="w-3 h-3 text-cyan-300" /> Avg / Active Mo
                  </span>
                  <div className="text-base sm:text-lg font-black font-mono text-cyan-300 mt-0.5">
                    ₹{avgMonthly.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-slate-300 truncate">
                    {monthsReturnedCount > 0 ? `across ${monthsReturnedCount} mo.` : 'no returns yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* OVERALL PAYMENTS SUMMARY CARDS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Overall Payments ({year})
                </h4>
                <span className="text-[11px] text-slate-500">
                  {entries.filter(e => e.is_locked === 0).length} of 12 months unlocked for edits
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 text-xs">
                {activeCols.map(col => (
                  <div 
                    key={col.id} 
                    className="p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between shadow-2xs"
                    style={{
                      backgroundColor: `${col.color || '#6366f1'}12`,
                      borderColor: `${col.color || '#6366f1'}35`
                    }}
                  >
                    <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider truncate" style={{ color: col.color || '#1e293b' }}>
                      {col.code}
                    </span>
                    <div className="font-mono text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                      ₹{(annual[col.field_key] || annual[`total_${col.field_key}`] || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}

                <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-2 sm:p-2.5 rounded-xl border border-indigo-700 text-white shadow-2xs flex items-center justify-between px-3">
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-indigo-200 uppercase tracking-wider block">GRAND TOTAL</span>
                    <span className="text-[9px] text-slate-300 font-sans">Annual Total</span>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-black text-emerald-300">
                    ₹{(annual.grand_total || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* VIEW MODE 1: TABLE VIEW */}
            {viewLayout === 'table' && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Monthly Statement (Apr {year} – Mar {year + 1})
                  </h4>
                  <span className="text-[11px] text-indigo-600 font-medium hidden sm:inline-flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Click on any unlocked month row to edit</span>
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Month</th>
                        <th className="py-2.5 px-2 text-center">Status</th>
                        {activeCols.map(col => (
                          <th key={col.id} className="py-2.5 px-2 text-right" style={{ color: col.color || undefined }}>
                            {col.code}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right font-extrabold text-emerald-700">Total</th>
                        <th className="py-2.5 px-2 text-center w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {entries.map((e) => {
                        const isCurrentlyEditing = editingMonth === e.month;
                        const isLocked = e.is_locked === 1;

                        if (isCurrentlyEditing) {
                          return (
                            <tr key={e.month} className="bg-indigo-50/70 transition-colors">
                              <td className="py-2 px-3 font-sans font-bold text-indigo-900 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span>{e.month_name}</span>
                                  <span className="text-[9px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded font-extrabold uppercase">
                                    Editing
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Unlock className="w-2.5 h-2.5 text-emerald-600" /> Unlocked
                                </span>
                              </td>
                              {/* Dynamic editable columns */}
                              {activeCols.map(col => (
                                <td key={col.id} className="py-1.5 px-1 text-right">
                                  <div className="relative inline-block">
                                    <span className="absolute left-1.5 top-1.5 text-[10px] text-slate-400 font-bold pointer-events-none">₹</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={editDraft[col.field_key] || ''}
                                      onChange={(ev) => handleDraftChange(col.field_key, ev.target.value)}
                                      onKeyDown={(ev) => handleKeyDown(ev, e.month)}
                                      placeholder="0"
                                      className="w-18 pl-4 pr-1.5 py-1 bg-white border border-slate-300 focus:border-indigo-500 rounded-lg text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                    />
                                  </div>
                                </td>
                              ))}
                              {/* Live Computed Row Total */}
                              <td className="py-2 px-3 text-right font-extrabold text-emerald-800 bg-emerald-50/80">
                                ₹{liveEditTotal.toLocaleString('en-IN')}
                              </td>
                              {/* Save / Cancel Quick Actions */}
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleSaveEdit(e.month);
                                    }}
                                    disabled={isSaving}
                                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    title="Save changes (or press Enter)"
                                  >
                                    {isSaving ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      cancelEditing();
                                    }}
                                    disabled={isSaving}
                                    className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                    title="Cancel (or press Esc)"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={e.month}
                            onClick={() => !isLocked && startEditing(e)}
                            className={`transition-colors ${
                              isLocked
                                ? 'bg-slate-50/40 text-slate-400'
                                : 'hover:bg-indigo-50/50 cursor-pointer group'
                            }`}
                            title={isLocked ? 'Month locked by Admin' : 'Click row to edit contribution'}
                          >
                            <td className="py-2.5 px-3 font-sans font-bold text-slate-900 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span>{e.month_name}</span>
                                {!isLocked && (
                                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-600 font-sans font-normal transition-opacity">
                                    (click to edit)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {isLocked ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200"
                                  title="Month locked by Admin. Edits restricted."
                                >
                                  <Lock className="w-2.5 h-2.5 text-slate-400" /> Locked
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  title="Unlocked: Click row to edit"
                                >
                                  <Unlock className="w-2.5 h-2.5 text-emerald-600" /> Unlocked
                                </span>
                              )}
                            </td>
                            {/* Dynamic column display cells */}
                            {activeCols.map(col => {
                              const val = e[col.field_key] || 0;
                              return (
                                <td key={col.id} className="py-2.5 px-2 text-right" style={{ color: col.color || '#334155' }}>
                                  {val > 0 ? `₹${val.toLocaleString('en-IN')}` : '-'}
                                </td>
                              );
                            })}
                            <td className={`py-2.5 px-3 text-right font-extrabold ${e.total > 0 ? 'text-emerald-800 bg-emerald-50' : 'text-slate-400'}`}>
                              {e.total > 0 ? `₹${e.total.toLocaleString('en-IN')}` : '₹0'}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-400">
                              {isLocked ? (
                                <Lock className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                              ) : (
                                <span className="text-[10px] text-indigo-500 font-sans opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                                  Edit
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono font-extrabold text-xs">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 font-sans uppercase text-slate-700">
                          OVERALL TOTAL
                        </td>
                        {activeCols.map(col => {
                          const val = annual[col.field_key] || annual[`total_${col.field_key}`] || 0;
                          return (
                            <td key={col.id} className="py-2.5 px-2 text-right" style={{ color: col.color || '#334155' }}>
                              ₹{val.toLocaleString('en-IN')}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right text-emerald-800 bg-emerald-100">
                          ₹{(annual.grand_total || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-400 font-sans text-[11px] font-normal">
                          FY {year}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW MODE 2: CARD VIEW */}
            {viewLayout === 'cards' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                    Month Cards (Apr {year} – Mar {year + 1})
                  </h4>
                  <span className="text-[11px] text-indigo-600 font-medium inline-flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Click on any unlocked month card to edit</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {entries.map((e, index) => {
                    const isCurrentlyEditing = editingMonth === e.month;
                    const isLocked = e.is_locked === 1;

                    return (
                      <div
                        key={e.month}
                        onClick={() => {
                          if (!isLocked && !isCurrentlyEditing) {
                            startEditing(e);
                          }
                        }}
                        className={`rounded-2xl border transition-all p-3.5 flex flex-col justify-between space-y-3 ${
                          isCurrentlyEditing
                            ? 'bg-indigo-50/50 border-indigo-400 shadow-md ring-2 ring-indigo-400/40'
                            : isLocked
                            ? 'bg-slate-50/60 border-slate-200/90 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md shadow-2xs cursor-pointer group'
                        }`}
                        title={isLocked ? 'Month locked by Admin' : isCurrentlyEditing ? '' : 'Click card to edit'}
                      >
                        {/* Card Header: Month Name, Sequence & Lock Status */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-black text-xs flex items-center justify-center shadow-2xs">
                              M{index + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 text-xs block group-hover:text-indigo-700 transition-colors">
                                {e.month_name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans">
                                {e.month >= 4 ? year : year + 1}
                              </span>
                            </div>
                          </div>

                          {/* Lock / Unlock Status Badge */}
                          {isLocked ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs"
                              title="Month locked by Admin. Edits restricted."
                            >
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                              <span>Locked</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                              title="Unlocked: Click card to edit"
                            >
                              <Unlock className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Unlocked</span>
                            </span>
                          )}
                        </div>

                        {/* Card Body: Dynamic Column Fields */}
                        {isCurrentlyEditing ? (
                          <div className="space-y-2 py-1" onClick={(ev) => ev.stopPropagation()}>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                              {activeCols.map(col => (
                                <div key={col.id}>
                                  <label className="text-[10px] font-extrabold uppercase block mb-1 truncate" style={{ color: col.color || '#1e293b' }}>
                                    {col.code} ({col.name})
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-[10px] text-slate-400 font-bold pointer-events-none">₹</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={editDraft[col.field_key] || ''}
                                      onChange={(ev) => handleDraftChange(col.field_key, ev.target.value)}
                                      onKeyDown={(ev) => handleKeyDown(ev, e.month)}
                                      placeholder="0"
                                      className="w-full pl-5 pr-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                            {activeCols.map(col => {
                              const val = e[col.field_key] || 0;
                              return (
                                <div 
                                  key={col.id} 
                                  className="p-1.5 rounded-xl border flex items-center justify-between"
                                  style={{
                                    backgroundColor: `${col.color || '#6366f1'}10`,
                                    borderColor: `${col.color || '#6366f1'}25`
                                  }}
                                >
                                  <span className="text-[9px] font-extrabold uppercase truncate" style={{ color: col.color || '#1e293b' }}>
                                    {col.code}
                                  </span>
                                  <span className="font-bold text-slate-900 text-xs truncate">
                                    {val > 0 ? `₹${val.toLocaleString('en-IN')}` : '₹0'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Card Footer: Total & Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-auto">
                          <div>
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">
                              MONTH TOTAL
                            </span>
                            <span className="font-mono font-black text-xs sm:text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-block shadow-2xs">
                              ₹{(isCurrentlyEditing ? liveEditTotal : (e.total || 0)).toLocaleString('en-IN')}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div>
                            {isCurrentlyEditing ? (
                              <div className="flex items-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(e.month)}
                                  disabled={isSaving}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                  title="Save (or press Enter)"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  disabled={isSaving}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all shadow-2xs cursor-pointer"
                                  title="Cancel (or press Esc)"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : !isLocked ? (
                              <span className="text-[10px] text-indigo-600 font-sans font-bold opacity-75 group-hover:opacity-100 transition-opacity">
                                Click to edit →
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-sans italic flex items-center gap-1">
                                <Lock className="w-3 h-3 text-slate-400" /> Locked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
        >
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
}
