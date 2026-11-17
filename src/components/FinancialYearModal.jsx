import React, { useState } from 'react';
import { Calendar, Plus, Trash2, CheckCircle2, Lock, ShieldCheck, RefreshCw, Copy } from 'lucide-react';
import { api } from '../utils/api';
import Modal from './common/Modal';
import MemberRolloverModal from './MemberRolloverModal';

export default function FinancialYearModal({
  isOpen,
  onClose,
  years,
  activeYear,
  onYearsUpdated,
  showToast
}) {
  const [newYearInput, setNewYearInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [settingActive, setSettingActive] = useState(null);
  const [deletingYear, setDeletingYear] = useState(null);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [rolloverSourceYear, setRolloverSourceYear] = useState(activeYear || 2026);

  const handleAddYear = async (e) => {
    e.preventDefault();
    const val = parseInt(newYearInput);
    if (isNaN(val) || val < 2000 || val > 2100) {
      showToast('Please enter a valid 4-digit financial year (e.g., 2028)', 'error');
      return;
    }

    try {
      setAdding(true);
      await api.addFinancialYear(val);
      showToast(`Financial Year ${val} added successfully!`, 'success');
      setNewYearInput('');
      onYearsUpdated();
    } catch (err) {
      showToast(err.message || 'Failed to add financial year', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleSetActive = async (yearToActivate) => {
    try {
      setSettingActive(yearToActivate);
      await api.setActiveFinancialYear(yearToActivate);
      showToast(`Financial Year FY ${yearToActivate} is now ACTIVE! All other years are locked for data entry.`, 'success');
      onYearsUpdated();
    } catch (err) {
      showToast(err.message || 'Failed to set active financial year', 'error');
    } finally {
      setSettingActive(null);
    }
  };

  const handleDeleteYear = async (yearToDelete) => {
    if (!window.confirm(`Are you sure you want to delete Financial Year ${yearToDelete}?`)) {
      return;
    }

    try {
      setDeletingYear(yearToDelete);
      await api.deleteFinancialYear(yearToDelete);
      showToast(`Financial Year ${yearToDelete} deleted.`, 'info');
      onYearsUpdated();
    } catch (err) {
      showToast(err.message || 'Failed to delete financial year', 'error');
    } finally {
      setDeletingYear(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <Modal.Header
        title="Financial Years & Active FY"
        subtitle="Set which Financial Year is active for data entry"
        icon={Calendar}
        onClose={onClose}
      />
      <Modal.Body className="space-y-3.5">
        {/* Info Alert */}
        <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong>Crucial Rule:</strong> Only the <strong>Active Financial Year</strong> allows new data entry and edits from Bial users. All other years are strictly locked as read-only.
          </span>
        </div>

        {/* Add Year Form */}
        <form onSubmit={handleAddYear} className="flex items-center gap-1.5">
          <input
            type="number"
            value={newYearInput}
            onChange={(e) => setNewYearInput(e.target.value)}
            placeholder="Add new FY (e.g. 2028)"
            className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 shadow-2xs min-w-0"
          />
          <button
            type="submit"
            disabled={adding || !newYearInput}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40 shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> <span>Add Year</span>
          </button>
        </form>

        {/* Configured Years List */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
            Configured Financial Years ({years.length})
          </span>
          {years.map(y => {
            const isActive = y === activeYear;
            return (
              <div
                key={y}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all shadow-2xs gap-2 ${
                  isActive
                    ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        FY {y} - {y + 1}
                      </span>
                      {isActive ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Active
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[9px] font-semibold uppercase tracking-wider flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans block truncate">
                      April {y} – March {y + 1}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                  {/* Rollover Quick Button */}
                  <button
                    onClick={() => {
                      setRolloverSourceYear(y);
                      setShowRolloverModal(true);
                    }}
                    className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                    title={`Rollover member names from FY ${y} to another year`}
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Rollover</span>
                  </button>

                  {!isActive ? (
                    <button
                      disabled={settingActive === y}
                      onClick={() => handleSetActive(y)}
                      className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-colors cursor-pointer"
                      title="Set as the active financial year"
                    >
                      {settingActive === y ? 'Activating...' : 'Make Active'}
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-100/60 rounded-lg">
                      Active
                    </span>
                  )}

                  <button
                    disabled={deletingYear === y || years.length <= 1}
                    onClick={() => handleDeleteYear(y)}
                    className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-20 transition-colors cursor-pointer"
                    title="Delete Year"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rollover Feature Box */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-xl bg-slate-200 text-slate-700 shrink-0">
                <RefreshCw className="w-4 h-4 text-slate-600" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">Member Names Rollover</h4>
                <p className="text-[10.5px] text-slate-500 font-medium truncate">Copy member names to another Financial Year</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRolloverSourceYear(activeYear || (years.length > 0 ? years[0] : 2026));
                setShowRolloverModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Rollover member names to another FY"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rollover</span>
            </button>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
        >
          Done
        </button>
      </Modal.Footer>

      {/* Member Rollover Modal triggered under Year Option */}
      <MemberRolloverModal
        isOpen={showRolloverModal}
        onClose={() => setShowRolloverModal(false)}
        currentYear={rolloverSourceYear || activeYear}
        financialYears={years}
        bialId="all"
        bialName="All Bials (System-wide)"
        showToast={showToast}
        onSuccess={() => {
          onYearsUpdated?.();
        }}
      />
    </Modal>
  );
}

