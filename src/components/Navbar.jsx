import React, { useState } from 'react';
import { Church, ShieldCheck, UserCheck, KeyRound, LogOut, Menu } from 'lucide-react';
import churchLogo from '../assets/church_logo.jpg';
import { api } from '../utils/api';
import Modal from './common/Modal';

export default function Navbar({ user, onLogout, showToast, onOpenMobileMenu }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      showToast('New password must be at least 4 characters long', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.changePassword({ currentPassword, newPassword });
      showToast('Password updated successfully!', 'success');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showToast(err.message || 'Failed to update password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {typeof window !== 'undefined' && (window.location.hostname.includes('test') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
        <div className="bg-amber-400 text-slate-950 font-semibold text-[11px] uppercase tracking-wider text-center py-1 px-4 flex items-center justify-center gap-2 select-none border-b border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0" />
          <span>Test Site &bull; Changes do not affect Live Production</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0" />
        </div>
      )}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between shadow-2xs">
        {/* Left: Logo */}
        <div className="flex items-center shrink-0">
          <img
            src={churchLogo}
            alt="Church Logo"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-slate-200 object-cover shadow-2xs shrink-0"
          />
        </div>

        {/* Center: Title & Centered Pathian Ram Khawnna */}
        <div className="min-w-0 flex-1 text-center px-1">
          <h1 className="font-heading font-bold text-sm sm:text-xl md:text-2xl text-slate-900 tracking-tight text-center leading-tight">
            Bethlehem Kohhran
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-600 font-semibold tracking-wider uppercase text-center mt-0.5">
            Pathian Ram Khawnna
          </p>
        </div>

        {/* Right Balance Spacer for True Center Alignment */}
        <div className="w-10 sm:w-12 shrink-0"></div>
      </nav>

      {/* Change Password Modal using Compound Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} maxWidth="max-w-md">
        <Modal.Header
          title="Change Password"
          subtitle="Update your security credentials"
          icon={KeyRound}
          onClose={() => setShowPasswordModal(false)}
        />
        <form onSubmit={handlePasswordSubmit}>
          <Modal.Body className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 4 chars)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm transition-all shadow-xs"
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Update Password'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

    </>
  );
}

