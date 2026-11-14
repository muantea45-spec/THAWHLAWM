import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, Trash2, Save, Lock, Edit3 } from 'lucide-react';
import { api } from '../utils/api';
import { FINANCIAL_MONTHS, DEFAULT_TITHE_COLUMNS } from '../utils/constants';
import Modal from './common/Modal';

export default function BialMemberEditModal({
  isOpen,
  onClose,
  member,
  bialName,
  bialId,
  year,
  month,
  columns = DEFAULT_TITHE_COLUMNS,
  isLocked = false,
  onSaved = () => {},
  showToast = () => {}
}) {
  const [name, setName] = useState('');
  const [slNo, setSlNo] = useState('');
  const [amounts, setAmounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    if (isLocked) {
      showToast('Month is locked by Admin. Changes cannot be saved.', 'error');
      return;
    }

    try {
      setSaving(true);
      const memberId = member.member_id || member.id;

      // 1. Update Member Name and Serial No
      await api.updateMember(memberId, {
        name: name.trim(),
        sl_no: parseInt(slNo) || member.sl_no
      });

      // 2. Save Tithes for selected Month
      if (bialId) {
        const tithePayload = {
          bial_id: bialId,
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

      showToast(`Updated tithes & info for ${name.trim()}!`, 'success');
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to update tithe figures', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const memberId = member.member_id || member.id;
    if (!window.confirm(`Are you sure you want to delete "${name}" from ${bialName || 'this Bial'}?`)) {
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
        title="Edit Member & Tithes"
        subtitle={`${bialName || 'Bial'} • ${monthName} FY ${year}`}
        icon={Edit3}
        onClose={onClose}
      />
      <form onSubmit={handleSave} className="space-y-4">
        <Modal.Body className="space-y-3.5">
          {/* Lock Notice if Month is locked */}
          {isLocked && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Month is locked by Admin. Records are view-only.</span>
            </div>
          )}

          {/* Section 1: Member Info */}
          <div className="space-y-2">
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
                  disabled={isLocked}
                  value={slNo}
                  onChange={(e) => setSlNo(e.target.value)}
                  className="w-full text-center font-mono font-bold px-2 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-600 text-base sm:text-xs shadow-2xs disabled:bg-slate-50"
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hming (Member Full Name)
                </label>
                <input
                  type="text"
                  required
                  disabled={isLocked}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lalthanpuia"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-indigo-600 text-base sm:text-xs shadow-2xs disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Tithe Breakdown for Selected Month */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                2. Tithe Figures for {monthName}
              </span>
              <span className="text-[11px] font-mono font-black text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                Total: ₹{calculatedTotal.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 font-mono">
              {activeCols.map((col, idx) => (
                <div 
                  key={col.id} 
                  className="p-2 sm:p-2.5 rounded-xl border transition-all"
                  style={{ 
                    backgroundColor: `${col.color || '#6366f1'}10`, 
                    borderColor: `${col.color || '#6366f1'}35` 
                  }}
                >
                  <label 
                    className="block text-[10.5px] font-extrabold mb-1 uppercase tracking-tight truncate"
                    style={{ color: col.color || '#1e293b' }}
                  >
                    {col.name} ({col.code})
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 text-xs font-bold text-slate-400 pointer-events-none">₹</span>
                    <input
                      ref={el => { inputRefs.current[idx] = el; }}
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      min="0"
                      step="any"
                      disabled={isLocked}
                      value={amounts[col.field_key] || ''}
                      onChange={(e) => handleAmountChange(col.field_key, e.target.value)}
                      onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                      placeholder="0"
                      className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base sm:text-xs shadow-2xs disabled:bg-slate-50"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <div className="flex items-center justify-between w-full gap-2">
            <button
              type="button"
              disabled={deleting || isLocked}
              onClick={handleDelete}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-30"
              title="Delete member"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || isLocked}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
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
