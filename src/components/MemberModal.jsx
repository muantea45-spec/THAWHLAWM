import React, { useState, useEffect } from 'react';
import { UserPlus, Edit3 } from 'lucide-react';
import Modal from './common/Modal';

export default function MemberModal({ isOpen, onClose, onSave, memberToEdit, nextSlNo }) {
  const [name, setName] = useState('');
  const [slNo, setSlNo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (memberToEdit) {
      setName(memberToEdit.name || '');
      setSlNo(memberToEdit.sl_no || '');
    } else {
      setName('');
      setSlNo(nextSlNo || '');
    }
  }, [memberToEdit, nextSlNo, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      await onSave({
        id: memberToEdit ? (memberToEdit.member_id || memberToEdit.id) : undefined,
        name: name.trim(),
        sl_no: parseInt(slNo) || nextSlNo
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <Modal.Header
        title={memberToEdit ? 'Edit Member Details' : 'Add New Church Member'}
        subtitle={memberToEdit ? `Updating #${slNo}` : `Assign serial number #${slNo}`}
        icon={memberToEdit ? Edit3 : UserPlus}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <Modal.Body className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Serial No (Sl No)
            </label>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              required
              value={slNo}
              onChange={(e) => setSlNo(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm font-mono shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Hming (Member Full Name)
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lalthanpuia"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm shadow-xs"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : memberToEdit ? 'Update Member' : 'Add Member'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

