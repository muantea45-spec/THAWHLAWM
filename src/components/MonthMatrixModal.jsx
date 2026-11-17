import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Calendar, Globe } from 'lucide-react';
import { api } from '../utils/api';
import { FINANCIAL_MONTHS, MONTH_NAME_MAP } from '../utils/constants';
import Modal from './common/Modal';

export default function MonthMatrixModal({ isOpen, onClose, showToast, currentYear }) {
  const [year, setYear] = useState(currentYear || new Date().getFullYear());
  const [bials, setBials] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentYear) {
      setYear(currentYear);
    }
  }, [currentYear, isOpen]);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await api.getMonthLocks(year);
      setBials(res.bials || []);
      setMatrix(res.matrix || {});
    } catch (err) {
      showToast(err.message || 'Failed to load month lock matrix', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMatrix();
    }
  }, [isOpen, year]);

  const handleToggleSingle = async (bialId, month) => {
    const isCurrentlyLocked = matrix[bialId]?.[month] === 1;
    const newLockedState = isCurrentlyLocked ? 0 : 1;
    setMatrix(prev => ({
      ...prev,
      [bialId]: {
        ...(prev[bialId] || {}),
        [month]: newLockedState
      }
    }));

    try {
      await api.toggleMonthLock({
        bial_id: bialId,
        year,
        month,
        is_locked: newLockedState
      });
      showToast(`Month ${MONTH_NAME_MAP[month]} ${newLockedState ? 'Locked' : 'Unlocked'}`, 'success');
    } catch (err) {
      fetchMatrix();
      showToast(err.message || 'Failed to update lock state', 'error');
    }
  };

  const handleToggleGlobal = async (month, shouldLock) => {
    const newLockedState = shouldLock ? 1 : 0;
    const updated = { ...matrix };
    bials.forEach(b => {
      if (!updated[b.id]) updated[b.id] = {};
      updated[b.id][month] = newLockedState;
    });
    setMatrix(updated);

    try {
      await api.toggleMonthLock({
        year,
        month,
        is_locked: newLockedState,
        global_toggle: true
      });
      showToast(`Month ${MONTH_NAME_MAP[month]} ${newLockedState ? 'Locked' : 'Unlocked'} for ALL Bials!`, 'info');
    } catch (err) {
      fetchMatrix();
      showToast(err.message || 'Failed global lock toggle', 'error');
    }
  };

  const handleToggleAllMonths = async (shouldLock) => {
    const actionWord = shouldLock ? 'LOCK' : 'UNLOCK';
    if (!window.confirm(`Are you sure you want to ${actionWord} ALL months (Jan-Dec) for ALL ${bials.length} Bials at once for FY ${year}?`)) {
      return;
    }

    const newLockedState = shouldLock ? 1 : 0;
    const updated = { ...matrix };
    bials.forEach(b => {
      if (!updated[b.id]) updated[b.id] = {};
      for (let m = 1; m <= 12; m++) {
        updated[b.id][m] = newLockedState;
      }
    });
    setMatrix(updated);

    try {
      await api.toggleMonthLock({
        year,
        all_months: true,
        is_locked: newLockedState
      });
      showToast(`ALL months (Jan-Dec) ${shouldLock ? 'Locked' : 'Unlocked'} for ALL Bials!`, 'success');
    } catch (err) {
      fetchMatrix();
      showToast(err.message || 'Failed to update all month locks', 'error');
    }
  };

  const [matrixView, setMatrixView] = useState('cards'); // 'cards' | 'table'
  const [selectedGlobalMonth, setSelectedGlobalMonth] = useState(4);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <Modal.Header
        title="Month Access Control (Bial Month Lock Manager)"
        subtitle="Locking a month restricts data entry and edits for all or specific Bials"
        icon={Calendar}
        onClose={onClose}
      />

      {/* Top Controls: FY Selector & View Mode Switcher */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-black text-slate-700 shrink-0">Financial Year:</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-1 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
          >
            <option value={2024}>2024-25</option>
            <option value={2025}>2025-26</option>
            <option value={2026}>2026-27</option>
            <option value={2027}>2027-28</option>
            <option value={2028}>2028-29</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setMatrixView('cards')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${matrixView === 'cards' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
              }`}
          >
            Cards View
          </button>
          <button
            onClick={() => setMatrixView('table')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${matrixView === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
              }`}
          >
            Table View
          </button>
        </div>
      </div>

      {/* Prominent Global Month Control Banner (All Months Master + Per-Month Bulk) */}
      <div className="m-3 p-3.5 rounded-2xl bg-slate-900 text-white shadow-xs border border-slate-800 space-y-3">
        {/* Row 1: MASTER ALL MONTHS (JAN - DEC) FOR ALL BIALS */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span>ALL MONTHS (JAN-DEC) MASTER CONTROL</span>
                <span className="text-[9px] bg-amber-400/20 text-amber-200 border border-amber-400/30 px-1.5 py-0.2 rounded font-mono">
                  12 Months • All Bials
                </span>
              </div>
              <div className="text-xs font-medium text-slate-300">
                Lock or unlock all 12 months for all {bials.length} Bials at once
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleToggleAllMonths(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Lock ALL 12 months for ALL Bials at once"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock All Months</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleAllMonths(false)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Unlock ALL 12 months for ALL Bials at once"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock All Months</span>
            </button>
          </div>
        </div>

        {/* Row 2: SINGLE MONTH BULK SELECTOR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-0.5">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
            <span className="font-semibold">Single Month Quick Control:</span>
            <span className="text-slate-400 text-[11px] hidden md:inline">Select a month to toggle for all bials</span>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-xl border border-indigo-400/30">
              <span className="text-[10px] uppercase text-indigo-200 font-extrabold">Month:</span>
              <select
                value={selectedGlobalMonth}
                onChange={(e) => setSelectedGlobalMonth(parseInt(e.target.value))}
                className="bg-transparent text-white font-extrabold text-xs focus:outline-none cursor-pointer"
              >
                {FINANCIAL_MONTHS.map(m => (
                  <option key={m.id} value={m.id} className="text-slate-900 font-bold">{m.name}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleToggleGlobal(selectedGlobalMonth, true)}
              className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              title={`Lock ${MONTH_NAME_MAP[selectedGlobalMonth]} for ALL Bials`}
            >
              <Lock className="w-3 h-3 text-rose-400" />
              <span>Lock {MONTH_NAME_MAP[selectedGlobalMonth]?.slice(0, 3)}</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleGlobal(selectedGlobalMonth, false)}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              title={`Unlock ${MONTH_NAME_MAP[selectedGlobalMonth]} for ALL Bials`}
            >
              <Unlock className="w-3 h-3 text-emerald-400" />
              <span>Unlock {MONTH_NAME_MAP[selectedGlobalMonth]?.slice(0, 3)}</span>
            </button>
          </div>
        </div>
      </div>

      <Modal.Body className="p-3 space-y-3 overflow-y-auto">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium">
            Loading Month Matrix...
          </div>
        ) : bials.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            No Bials registered in the system yet.
          </div>
        ) : matrixView === 'cards' ? (
          /* Cards Matrix View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bials.map(b => (
              <div
                key={b.id}
                className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-slate-900 text-xs truncate">{b.name}</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {b.code}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">12 Months</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {FINANCIAL_MONTHS.map(mObj => {
                    const mNum = mObj.id;
                    const isLocked = matrix[b.id]?.[mNum] === 1;

                    return (
                      <button
                        key={mObj.id}
                        type="button"
                        onClick={() => handleToggleSingle(b.id, mNum)}
                        className={`p-1.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${isLocked
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                        title={`${mObj.name}: Click to ${isLocked ? 'Unlock' : 'Lock'}`}
                      >
                        <span className="text-[9px] font-extrabold uppercase">{mObj.short}</span>
                        {isLocked ? (
                          <Lock className="w-3 h-3 text-rose-600 mt-0.5" />
                        ) : (
                          <Unlock className="w-3 h-3 text-emerald-600 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table Matrix View */
          <div className="overflow-x-auto w-full border border-slate-200 rounded-2xl bg-white shadow-2xs">
            <table className="w-full text-left border-collapse min-w-[650px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100">
                  <th className="py-2.5 px-3 sticky left-0 z-10 bg-slate-100 shadow-2xs">Bial</th>
                  {FINANCIAL_MONTHS.map((mObj) => (
                    <th key={mObj.id} className="py-2.5 px-1 text-center font-bold">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{mObj.short}</span>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleToggleGlobal(mObj.id, true)}
                            className="p-0.5 rounded hover:bg-rose-200 text-rose-700 transition-colors"
                            title={`Lock ${mObj.name} for ALL Bials`}
                          >
                            <Lock className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleGlobal(mObj.id, false)}
                            className="p-0.5 rounded hover:bg-emerald-200 text-emerald-700 transition-colors"
                            title={`Unlock ${mObj.name} for ALL Bials`}
                          >
                            <Unlock className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {bials.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-900 sticky left-0 z-10 bg-white shadow-2xs">
                      <div className="truncate max-w-[120px]">{b.name}</div>
                    </td>
                    {FINANCIAL_MONTHS.map((mObj) => {
                      const mNum = mObj.id;
                      const isLocked = matrix[b.id]?.[mNum] === 1;

                      return (
                        <td key={mObj.id} className="py-1.5 px-0.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSingle(b.id, mNum)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all cursor-pointer ${isLocked
                              ? 'bg-rose-100 border border-rose-300 text-rose-700'
                              : 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                              }`}
                          >
                            {isLocked ? (
                              <Lock className="w-3 h-3 text-rose-700" />
                            ) : (
                              <Unlock className="w-3 h-3 text-emerald-700" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="justify-between">
        <div className="flex items-center gap-2.5 text-[10.5px] text-slate-600 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500 inline-block"></span>
            Open
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-rose-500 inline-block"></span>
            Locked
          </span>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer"
        >
          Done
        </button>
      </Modal.Footer>
    </Modal>
  );
}


