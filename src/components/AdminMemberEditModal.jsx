import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, Trash2, Save, ShieldCheck, Check, DollarSign, ArrowRightLeft, Copy } from 'lucide-react';
import { api } from '../utils/api';
import { FINANCIAL_MONTHS, DEFAULT_TITHE_COLUMNS } from '../utils/constants';
import Modal from './common/Modal';

export default function AdminMemberEditModal({
  isOpen,
  onClose,
  member,
  bial,
  year,
  month,
  columns = DEFAULT_TITHE_COLUMNS,
  onSaved,
  onTransferClick,
  showToast
}) {
  const [name, setName] = useState('');
  const [slNo, setSlNo] = useState('');
  const [amounts, setAmounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingPreviousMonth, setLoadingPreviousMonth] = useState(false);

  const inputRefs = useRef([]);
  const activeCols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;

  useEffect(() => {
    if (member) {
      setName(member.name || '');
      setSlNo(member.sl_no || '');
      const initAmounts = {};
      activeCols.forEach(col => {
        const v = member[col.field_key];
        initAmounts[col.field_key] = (v !== undefined && v !== null && v !== '') ? String(v) : '';
      });
      setAmounts(initAmounts);
    }
  }, [member, isOpen]);

  const handleAmountChange = (fieldKey, val) => {
    setAmounts(prev => ({ ...prev, [fieldKey]: val }));
  };

  const handleRepeatPreviousMonth = async () => {
    const memberId = member?.member_id || member?.id;
    if (!memberId) return;

    try {
      setLoadingPreviousMonth(true);
      const historyRes = await api.getMemberHistory(memberId, year);
      const monthlyEntries = historyRes?.monthlyEntries || [];
      
      const monthOrder = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      const currentIdx = monthOrder.indexOf(month);
      
      let targetEntry = null;
      for (let i = currentIdx - 1; i >= 0; i--) {
        const mNum = monthOrder[i];
        const found = monthlyEntries.find(e => e.month === mNum && Number(e.total) > 0);
        if (found) {
          targetEntry = found;
          break;
        }
      }
      
      if (!targetEntry) {
        targetEntry = monthlyEntries.find(e => Number(e.total) > 0);
      }

      if (!targetEntry) {
        if (showToast) showToast('No previous month records found to repeat', 'info');
        return;
      }

      const newAmounts = { ...amounts };
      activeCols.forEach(col => {
        const v = targetEntry[col.field_key];
        newAmounts[col.field_key] = (v !== undefined && v !== null && Number(v) > 0) ? String(v) : '';
      });
      setAmounts(newAmounts);

      const targetMonthName = FINANCIAL_MONTHS.find(m => m.id === targetEntry.month)?.name || `Month ${targetEntry.month}`;
      if (showToast) showToast(`Copied previous tithes from ${targetMonthName}!`, 'success');
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to fetch previous month data', 'error');
    } finally {
      setLoadingPreviousMonth(false);
    }
  };

  const handleAmountKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < activeCols.length - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        handleSave(e);
      }
    }
  };

  const calculatedTotal = activeCols.reduce((sum, col) => {
    return sum + (parseFloat(amounts[col.field_key]) || 0);
  }, 0);

  const monthName = FINANCIAL_MONTHS.find(m => m.id === month)?.name || `Month ${month}`;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Member name (HMING) cannot be empty', 'error');
      return;
    }

    try {
      setSaving(true);
      const memberId = member.member_id || member.id;

      // 1. Update Member Details (Name and Serial No)
      await api.updateMember(memberId, {
        name: name.trim(),
        sl_no: parseInt(slNo) || member.sl_no
      });

      // 2. Update Member Tithes for the selected Month & Year
      if (bial?.id) {
        const tithePayload = {
          bial_id: bial.id,
          member_id: memberId,
          year,
          month,
          pathian_ram: parseFloat(amounts.pathian_ram) || 0,
          ramthar: parseFloat(amounts.ramthar) || 0,
          tualchhung: parseFloat(amounts.tualchhung) || 0,
          building: parseFloat(amounts.building) || 0
        };
        activeCols.forEach(col => {
          tithePayload[col.field_key] = parseFloat(amounts[col.field_key]) || 0;
        });

        await api.saveTithe(tithePayload);
      }

      showToast(`Updated details & tithe data for ${name.trim()}!`, 'success');
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to update member data', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const memberId = member.member_id || member.id;
    if (!window.confirm(`Are you sure you want to delete "${name}" from ${bial?.name || 'Bial'} and ALL associated tithe records?`)) {
      return;
    }

    try {
      setDeleting(true);
      await api.deleteMember(memberId);
      showToast(`Member "${name}" deleted.`, 'info');
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to delete member', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (!member) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <Modal.Header
        title="Admin Edit Member & Data"
        subtitle={`${bial?.name || 'Bial'} • ${monthName} FY ${year}`}
        icon={UserCheck}
        onClose={onClose}
      />
      <form onSubmit={handleSave} className="space-y-4">
        <Modal.Body className="space-y-3.5">
          {/* Admin Authority Banner */}
          <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Admin Authority: You can edit any member info and tithe entries across all Bials.</span>
          </div>

          {/* Section 1: Member Identity */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
              1. Member Identity
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Sl No
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={slNo}
                  onChange={(e) => setSlNo(e.target.value)}
                  className="w-full text-center font-mono font-bold px-2 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-600 text-xs shadow-2xs"
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hming (Member Full Name)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lalthanpuia"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-indigo-600 text-xs shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Tithe Breakdown for Selected Month */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                2. Tithes for {monthName} (FY {year})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={loadingPreviousMonth}
                  onClick={handleRepeatPreviousMonth}
                  className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10.5px] border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Copy tithe amounts from the previous recorded month"
                >
                  <Copy className="w-3 h-3 text-indigo-600" />
                  <span>{loadingPreviousMonth ? 'Copying...' : 'Hmasa Ang'}</span>
                </button>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Total: ₹{calculatedTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              {activeCols.map((col, idx) => (
                <div 
                  key={col.id} 
                  className="p-2 rounded-xl border transition-all"
                  style={{ 
                    backgroundColor: `${col.color || '#6366f1'}10`, 
                    borderColor: `${col.color || '#6366f1'}35` 
                  }}
                >
                  <label 
                    className="block text-[10.5px] font-extrabold mb-1 truncate uppercase tracking-tight"
                    style={{ color: col.color || '#1e293b' }}
                  >
                    {col.name} ({col.code})
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-2 text-xs font-bold text-slate-400 pointer-events-none">₹</span>
                    <input
                      ref={el => { inputRefs.current[idx] = el; }}
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      min="0"
                      step="any"
                      value={amounts[col.field_key] || ''}
                      onChange={(e) => handleAmountChange(col.field_key, e.target.value)}
                      onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                      placeholder="0"
                      className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs shadow-2xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer border border-rose-200 shadow-2xs disabled:opacity-50"
                title="Delete member permanently"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              {onTransferClick && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTransferClick(member);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors cursor-pointer border border-blue-200 shadow-2xs"
                  title="Transfer this member to another Bial"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Transfer</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
