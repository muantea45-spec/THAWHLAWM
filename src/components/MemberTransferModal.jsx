import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, UserCheck, ShieldAlert, ArrowRight, CheckCircle2, Search, Building2 } from 'lucide-react';
import Modal from './common/Modal';
import { api } from '../utils/api';

export default function MemberTransferModal({
  isOpen,
  onClose,
  bials = [],
  preselectedMember = null,
  preselectedBialId = null,
  onTransferred,
  showToast
}) {
  const [sourceBialId, setSourceBialId] = useState('');
  const [membersList, setMembersList] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [destinationBialId, setDestinationBialId] = useState('');
  const [newSlNo, setNewSlNo] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'audit'
  const [transferLogs, setTransferLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('pathian_ram_transfer_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const saveLog = (entry) => {
    const updated = [entry, ...transferLogs].slice(0, 50);
    setTransferLogs(updated);
    try {
      localStorage.setItem('pathian_ram_transfer_logs', JSON.stringify(updated));
    } catch (e) {}
  };

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preselectedBialId) {
        setSourceBialId(String(preselectedBialId));
      } else if (bials.length > 0) {
        setSourceBialId(String(bials[0].id));
      }

      if (preselectedMember) {
        setSelectedMemberId(String(preselectedMember.id || preselectedMember.member_id));
      } else {
        setSelectedMemberId('');
      }

      // Default destination to another Bial
      if (bials.length > 1) {
        const other = bials.find(b => String(b.id) !== String(preselectedBialId || (bials[0] && bials[0].id)));
        if (other) setDestinationBialId(String(other.id));
      } else {
        setDestinationBialId('');
      }
      setSearchMemberQuery('');
    }
  }, [isOpen, preselectedMember, preselectedBialId, bials]);

  // Load members whenever sourceBialId changes
  useEffect(() => {
    if (isOpen && sourceBialId) {
      setLoadingMembers(true);
      api.getMembers(sourceBialId)
        .then(res => {
          const list = Array.isArray(res) ? res : (res.members || []);
          setMembersList(list);
          if (preselectedMember && String(preselectedMember.bial_id) === String(sourceBialId)) {
            setSelectedMemberId(String(preselectedMember.id || preselectedMember.member_id));
          } else if (list.length > 0 && !selectedMemberId) {
            setSelectedMemberId(String(list[0].id));
          }
        })
        .catch(err => {
          console.error('Failed to load members for Bial:', err);
        })
        .finally(() => {
          setLoadingMembers(false);
        });
    }
  }, [isOpen, sourceBialId]);

  // Auto calculate next available Sl No in destination Bial
  useEffect(() => {
    if (isOpen && destinationBialId) {
      api.getMembers(destinationBialId)
        .then(res => {
          const list = Array.isArray(res) ? res : (res.members || []);
          const maxSl = list.reduce((max, m) => Math.max(max, m.sl_no || 0), 0);
          setNewSlNo(String(maxSl + 1));
        })
        .catch(() => {
          setNewSlNo('1');
        });
    }
  }, [isOpen, destinationBialId]);

  const selectedMemberObj = membersList.find(m => String(m.id) === String(selectedMemberId));
  const sourceBialObj = bials.find(b => String(b.id) === String(sourceBialId));
  const destinationBialObj = bials.find(b => String(b.id) === String(destinationBialId));

  const filteredMembers = membersList.filter(m =>
    m.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
    String(m.sl_no).includes(searchMemberQuery)
  );

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!selectedMemberId) {
      showToast('Please select a member to transfer', 'error');
      return;
    }
    if (!destinationBialId) {
      showToast('Please select a destination Bial', 'error');
      return;
    }
    if (String(sourceBialId) === String(destinationBialId)) {
      showToast('Source and Destination Bial must be different', 'error');
      return;
    }

    const memberName = selectedMemberObj?.name || 'Selected member';
    const conf = window.confirm(
      `TRANSFER CONFIRMATION:\n\nAre you sure you want to transfer "${memberName}" from ${sourceBialObj?.name} to ${destinationBialObj?.name}?\n\nAll historical contributions & active records will be updated simultaneously.`
    );
    if (!conf) return;

    try {
      setTransferring(true);
      const res = await api.transferMember({
        member_id: parseInt(selectedMemberId),
        target_bial_id: parseInt(destinationBialId),
        new_sl_no: parseInt(newSlNo) || undefined
      });

      showToast(res.message || `Member "${memberName}" transferred successfully!`, 'success');
      
      saveLog({
        id: Date.now(),
        memberName: memberName,
        fromBial: sourceBialObj?.name || `Bial ${sourceBialId}`,
        toBial: destinationBialObj?.name || `Bial ${destinationBialId}`,
        newSlNo: newSlNo,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      });

      if (onTransferred) onTransferred(res.member);
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to transfer member', 'error');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <Modal.Header
        title="Member Transfer & Audit Log"
        subtitle="Transfer member records & view audit history"
        icon={ArrowRightLeft}
        onClose={onClose}
      />

      {/* Tab Switcher */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-bold w-full">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
              activeTab === 'form' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Transfer Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
              activeTab === 'audit' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Audit Log ({transferLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'audit' ? (
        <Modal.Body className="space-y-3 text-xs max-h-[400px] overflow-y-auto">
          {transferLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-medium">
              No recent member transfers recorded in this session.
            </div>
          ) : (
            <div className="space-y-2">
              {transferLogs.map(log => (
                <div key={log.id} className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-900 text-xs">{log.memberName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-100">{log.fromBial}</span>
                    <span>➔</span>
                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-100">{log.toBial}</span>
                    <span className="text-slate-400 ml-auto">New Sl: #{log.newSlNo}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      ) : (
        <form onSubmit={handleTransfer} className="space-y-3.5">
          <Modal.Body className="space-y-3 text-xs">
            
            {/* Visual Route Flow Header */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between gap-1 text-center font-bold">
                <div className="flex-1 bg-white p-2 rounded-xl border border-slate-200 truncate">
                  <span className="text-[9px] text-slate-500 uppercase block font-semibold">FROM</span>
                  <span className="text-xs text-slate-900 truncate font-bold">{sourceBialObj?.name || 'Source'}</span>
                </div>

                <div className="px-1.5 shrink-0 flex flex-col items-center">
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex-1 bg-white p-2 rounded-xl border border-slate-200 truncate">
                  <span className="text-[9px] text-indigo-600 uppercase block font-semibold">TO</span>
                  <span className="text-xs text-slate-900 truncate font-bold">{destinationBialObj?.name || 'Destination'}</span>
                </div>
              </div>
            </div>

            {/* Step 1: Source Bial */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">
                Source Bial (Current Location)
              </label>
              <select
                value={sourceBialId}
                onChange={(e) => setSourceBialId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-bold text-xs text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
              >
                {bials.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            {/* Step 2: Member Selection */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>Select Member to Transfer</span>
                <span className="text-[10px] text-slate-400 font-normal">{membersList.length} members</span>
              </label>

              <div className="relative mb-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  placeholder="Filter member by name or Sl..."
                  className="w-full pl-8 pr-2 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs"
                />
              </div>

              {loadingMembers ? (
                <div className="py-4 text-center text-xs text-slate-500 font-medium">
                  Loading members...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 text-center text-slate-500 text-xs font-medium">
                  No members found in this Bial.
                </div>
              ) : (
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-bold text-xs text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                >
                  {filteredMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      Sl. {m.sl_no} - {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 3: Destination Bial */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">
                Destination Bial (New Location)
              </label>
              <select
                value={destinationBialId}
                onChange={(e) => setDestinationBialId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-bold text-xs text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
              >
                {bials.filter(b => String(b.id) !== String(sourceBialId)).map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            {/* Step 4: New Sl No Assignment */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">
                Assigned Sl. No in Destination Bial
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newSlNo}
                  onChange={(e) => setNewSlNo(e.target.value)}
                  placeholder="Auto Sl..."
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-indigo-600 shadow-2xs"
                />
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  (Auto Sl)
                </span>
              </div>
            </div>

            {/* Confirmation Notice */}
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-tight">
                <span className="font-bold">Simultaneous Data Sync:</span> All past monthly tithe records for this member will automatically be reassigned to {destinationBialObj?.name || 'the new Bial'}.
              </div>
            </div>

          </Modal.Body>

          <Modal.Footer>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferring || !selectedMemberId || !destinationBialId || String(sourceBialId) === String(destinationBialId)}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{transferring ? 'Transferring...' : 'Transfer Member'}</span>
            </button>
          </Modal.Footer>
        </form>
      )}
    </Modal>
  );
}
