import React, { useState, useEffect } from 'react';
import { Building2, Edit } from 'lucide-react';
import Modal from './common/Modal';

export default function BialModal({ isOpen, onClose, onSave, bialToEdit }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bialToEdit) {
      setName(bialToEdit.name || '');
      setCode(bialToEdit.code || '');
      setUsername(bialToEdit.username || '');
      setPassword('');
      setStatus(bialToEdit.status || 'active');
    } else {
      setName('');
      setCode('');
      setUsername('');
      setPassword('');
      setStatus('active');
    }
  }, [bialToEdit, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !username.trim()) return;
    if (!bialToEdit && !password) return;

    try {
      setLoading(true);
      await onSave({
        id: bialToEdit ? bialToEdit.id : undefined,
        name: name.trim(),
        code: code.trim(),
        username: username.trim(),
        password: password ? password.trim() : undefined,
        status
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-[395px]">
      <Modal.Header
        title={bialToEdit ? 'Edit Bial Account' : 'Create Bial Account'}
        subtitle={bialToEdit ? `Updating ${name}` : 'Set up credentials and region details'}
        icon={bialToEdit ? Edit : Building2}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <Modal.Body className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Bial Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bial 1"
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 text-xs shadow-2xs"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. B1"
                className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-600 text-xs shadow-2xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Login Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin_b1"
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 text-xs shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {bialToEdit ? 'New Password (Optional)' : 'Password'}
              </label>
              <input
                type="password"
                required={!bialToEdit}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={bialToEdit ? 'Leave blank to keep current' : 'Set Bial password'}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 text-xs shadow-2xs"
              />
            </div>
          </div>

          {bialToEdit && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Account Access Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-600 text-xs shadow-2xs"
              >
                <option value="active">Active (Unlocked Account)</option>
                <option value="locked">Locked (Disabled Account)</option>
              </select>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Saving...' : bialToEdit ? 'Save' : 'Create Bial'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

