import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowRight, CheckCircle2, AlertCircle, Copy, Users } from 'lucide-react';
import Modal from './common/Modal';
import { api } from '../utils/api';

export default function MemberRolloverModal({
  isOpen,
  onClose,
  currentYear,
  financialYears = [],
  bialId,
  bialName,
  onSuccess,
  showToast
}) {
  const [sourceYear, setSourceYear] = useState(currentYear || 2026);
  const [targetYear, setTargetYear] = useState(currentYear ? currentYear + 1 : 2027);
  const [loading, setLoading] = useState(false);
  const [sourceMemberCount, setSourceMemberCount] = useState(null);
  const [fetchingCount, setFetchingCount] = useState(false);

  useEffect(() => {
    if (currentYear) {
      setSourceYear(currentYear);
      // Pick next year from financialYears if available, otherwise currentYear + 1
      const sortedYears = [...financialYears].sort((a, b) => a - b);
      const nextYear = sortedYears.find(y => y > currentYear) || (currentYear + 1);
      setTargetYear(nextYear);
    }
  }, [currentYear, financialYears, isOpen]);

  useEffect(() => {
    if (!isOpen || !sourceYear) return;

    let isMounted = true;
    setFetchingCount(true);

    const fetchPromise = (!bialId || bialId === 'all')
      ? api.getAllMembers(sourceYear)
      : api.getMembers(bialId, sourceYear);

    fetchPromise
      .then(members => {
        if (isMounted) {
          setSourceMemberCount(Array.isArray(members) ? members.length : 0);
        }
      })
      .catch(() => {
        if (isMounted) setSourceMemberCount(0);
      })
      .finally(() => {
        if (isMounted) setFetchingCount(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, bialId, sourceYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sourceYear === targetYear) {
      showToast?.('Source and Target financial years must be different', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.rolloverMembers({
        source_year: sourceYear,
        target_year: targetYear,
        bial_id: bialId
      });

      showToast?.(res.message || `Rolled over members to FY ${targetYear}!`, 'success');
      onSuccess?.(targetYear);
      onClose();
    } catch (err) {
      showToast?.(err.message || 'Failed to rollover members', 'error');
    } finally {
      setLoading(false);
    }
  };

  const availableTargetYears = financialYears.filter(y => y !== sourceYear);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <Modal.Header
        title="Rollover Members to Next FY"
        subtitle={bialName ? `Scope: ${bialName}` : 'Copy member names across financial years'}
        icon={RefreshCw}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <Modal.Body className="space-y-4">
          
          {/* Info Banner */}
          <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl text-xs space-y-1 text-indigo-950">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900">
              <Copy className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Names-Only Rollover</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              This will copy all member names and serial numbers from the <strong>Source FY</strong> into the <strong>Target FY</strong>. All monthly tithe amounts in the new FY will start clean at <strong>₹0</strong>.
            </p>
          </div>

          {/* Source & Target Year Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            
            {/* Source FY */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Source Financial Year
              </label>
              <select
                value={sourceYear}
                onChange={(e) => setSourceYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {financialYears.map(y => (
                  <option key={y} value={y}>FY {y} - {y + 1}</option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  {fetchingCount ? 'Counting members...' : `${sourceMemberCount ?? 0} members available`}
                </span>
              </div>
            </div>

            {/* Target FY */}
            <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                Target Financial Year
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-300 text-indigo-950 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {availableTargetYears.length === 0 && (
                  <option value={sourceYear + 1}>FY {sourceYear + 1} - {sourceYear + 2} (New)</option>
                )}
                {availableTargetYears.map(y => (
                  <option key={y} value={y}>FY {y} - {y + 1}</option>
                ))}
                {!financialYears.includes(sourceYear + 1) && (
                  <option value={sourceYear + 1}>FY {sourceYear + 1} - {sourceYear + 2} (Next)</option>
                )}
              </select>

              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold pt-1 border-t border-indigo-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>No duplicate names created</span>
              </div>
            </div>

          </div>

          {sourceMemberCount === 0 && !fetchingCount && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>No members exist in FY {sourceYear}. Add members first before rolling over.</span>
            </div>
          )}

        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || sourceYear === targetYear || sourceMemberCount === 0}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Rolling over...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rollover to FY {targetYear}</span>
              </>
            )}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
