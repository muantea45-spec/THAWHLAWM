import React, { useState, useEffect } from 'react';
import {
  Key, Plus, Lock, Unlock, Trash2, Edit, Search, ShieldCheck,
  Check, X, RefreshCw, Mail, Users, Sparkles, Crown, ArrowRightLeft,
  KeyRound, Shield, AlertCircle, Copy, ExternalLink, UserCheck
} from 'lucide-react';
import { api } from '../utils/api';

function GoogleIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export default function CredentialsTab({
  bials = [],
  onRefresh = () => {},
  onEditBial = () => {},
  onAddNewBial = () => {},
  showToast = () => {}
}) {
  const [subView, setSubView] = useState('both'); // 'both' | 'bials' | 'admins'
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingBialId, setResettingBialId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Admin Google Logins state
  const [googleEmails, setGoogleEmails] = useState([]);
  const [primaryAdminEmail, setPrimaryAdminEmail] = useState(null);
  const [loadingGoogleEmails, setLoadingGoogleEmails] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [showTransferOwnerBox, setShowTransferOwnerBox] = useState(false);
  const [targetOwnerEmail, setTargetOwnerEmail] = useState('');
  const [transferringOwner, setTransferringOwner] = useState(false);

  useEffect(() => {
    fetchGoogleEmails();
  }, []);

  const fetchGoogleEmails = async () => {
    try {
      setLoadingGoogleEmails(true);
      const res = await api.getAdminGoogleEmails();
      setGoogleEmails(res?.emails || []);
      setPrimaryAdminEmail(res?.primaryAdminEmail || null);
    } catch (err) {
      if (showToast) showToast('Failed to load admin Google emails', 'error');
    } finally {
      setLoadingGoogleEmails(false);
    }
  };

  const handleAddAdminEmail = async (e) => {
    e.preventDefault();
    const emailToSubmit = newAdminEmail.trim().toLowerCase();
    if (!emailToSubmit || !emailToSubmit.includes('@')) {
      if (showToast) showToast('Please enter a valid email address', 'error');
      return;
    }

    try {
      setAddingEmail(true);
      const res = await api.addAdminGoogleEmail(emailToSubmit);
      if (showToast) showToast(res?.message || `Successfully added ${emailToSubmit} as an Admin!`, 'success');
      setNewAdminEmail('');
      fetchGoogleEmails();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to authorize admin email', 'error');
    } finally {
      setAddingEmail(false);
    }
  };

  const handleDeleteAdminEmail = async (id, email) => {
    if (!window.confirm(`Revoke Admin Google login privileges for ${email}?`)) return;
    try {
      await api.deleteAdminGoogleEmail(id);
      if (showToast) showToast(`Revoked admin access for ${email}`, 'info');
      fetchGoogleEmails();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to remove admin email', 'error');
    }
  };

  const handleTransferOwner = async (emailToSet) => {
    const cleanEmail = String(emailToSet || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      if (showToast) showToast('Please enter a valid Google email for the new owner', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to transfer Primary Account Ownership to ${cleanEmail}? You will remain an authorized administrator.`)) {
      return;
    }

    try {
      setTransferringOwner(true);
      const res = await api.setPrimaryAdminOwner(cleanEmail);
      if (showToast) showToast(res?.message || `Primary Owner transferred to ${cleanEmail}!`, 'success');
      setShowTransferOwnerBox(false);
      setTargetOwnerEmail('');
      fetchGoogleEmails();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to transfer ownership', 'error');
    } finally {
      setTransferringOwner(false);
    }
  };

  const handleToggleStatus = async (bial) => {
    const newStatus = bial.status === 'locked' ? 'active' : 'locked';
    try {
      await api.updateBial(bial.id, { status: newStatus });
      if (showToast) {
        showToast(`Bial account "${bial.name}" is now ${newStatus.toUpperCase()}`, 'info');
      }
      onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to update Bial status', 'error');
    }
  };

  const handleStartPasswordReset = (bial) => {
    setResettingBialId(bial.id);
    setNewPassword('');
  };

  const handleCancelPasswordReset = () => {
    setResettingBialId(null);
    setNewPassword('');
  };

  const handleSavePasswordReset = async (bialId) => {
    if (!newPassword || newPassword.trim().length < 4) {
      if (showToast) showToast('Password must be at least 4 characters long', 'error');
      return;
    }

    try {
      setSavingPassword(true);
      await api.updateBial(bialId, { password: newPassword.trim() });
      if (showToast) showToast('Password reset successfully!', 'success');
      setResettingBialId(null);
      setNewPassword('');
      onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteBial = async (bial) => {
    if (!window.confirm(`Are you sure you want to permanently delete Bial "${bial.name}" (username: ${bial.username}) and all its member and tithe records?`)) {
      return;
    }
    try {
      await api.deleteBial(bial.id);
      if (showToast) showToast(`Bial account "${bial.name}" deleted.`, 'info');
      onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to delete Bial', 'error');
    }
  };

  const filteredBials = bials.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.code && b.code.toLowerCase().includes(q)) ||
      (b.username && b.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header Card */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600" /> User Passwords & Admin Access
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Unified management for Bial collector login credentials, password resets, and authorized Google Admin accounts.
          </p>
        </div>

        {/* View Filter Pill Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-center shadow-2xs">
          <button
            type="button"
            onClick={() => setSubView('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subView === 'both'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All in One
          </button>
          <button
            type="button"
            onClick={() => setSubView('bials')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              subView === 'bials'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Bial Passwords ({bials.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('admins')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              subView === 'admins'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Admins ({googleEmails.length + (primaryAdminEmail ? 1 : 0)})</span>
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${subView === 'both' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        {/* ======================================================== */}
        {/* SECTION A: BIAL USER PASSWORDS & CREDENTIALS             */}
        {/* ======================================================== */}
        {(subView === 'both' || subView === 'bials') && (
          <div className={`glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-3.5 bg-white shadow-2xs border border-slate-200/80 ${subView === 'both' ? 'lg:col-span-7' : 'w-full'}`}>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">Bial Collector Accounts</h4>
                <span className="text-[10.5px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                  {filteredBials.length} Accounts
                </span>
              </div>

              <button
                onClick={onAddNewBial}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> <span>Add Bial</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Bial name, code, or username..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white shadow-2xs"
              />
            </div>

            {/* Bials Credentials List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
              {filteredBials.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-sans">
                  No Bial accounts found matching your search.
                </div>
              ) : (
                filteredBials.map((b, index) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors shadow-2xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{b.name}</span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {b.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                            <span>Username:</span>
                            <span className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                              {b.username}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              b.status === 'locked' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {b.status === 'locked' ? 'Locked' : 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 justify-end">
                        <button
                          onClick={() => handleToggleStatus(b)}
                          className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            b.status === 'locked'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={b.status === 'locked' ? 'Unlock Account' : 'Lock Account'}
                        >
                          {b.status === 'locked' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleStartPasswordReset(b)}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          Reset Pass
                        </button>

                        <button
                          onClick={() => onEditBial(b)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                          title="Edit Bial Details"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteBial(b)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Bial"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Inline Password Reset Input */}
                    {resettingBialId === b.id && (
                      <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in duration-150">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider shrink-0">
                          New Password:
                        </span>
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 4 chars)"
                          className="flex-1 px-3 py-1 rounded-lg bg-white border border-indigo-300 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5 shrink-0 justify-end">
                          <button
                            onClick={() => handleSavePasswordReset(b.id)}
                            disabled={savingPassword || !newPassword}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer shadow-2xs"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            onClick={handleCancelPasswordReset}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SECTION B: MANAGE ADMINS (GOOGLE LOGINS)                  */}
        {/* ======================================================== */}
        {(subView === 'both' || subView === 'admins') && (
          <div className={`glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-3.5 bg-white shadow-2xs border border-slate-200/80 ${subView === 'both' ? 'lg:col-span-5' : 'w-full'}`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">Manage Admins (Google Logins)</h4>
              </div>
              <button
                onClick={fetchGoogleEmails}
                disabled={loadingGoogleEmails}
                className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
                title="Refresh Admin List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGoogleEmails ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Explanatory callout */}
            <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-indigo-50/90 rounded-2xl border border-indigo-200/80 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <GoogleIcon className="w-4 h-4 shrink-0" />
                <span className="font-bold text-indigo-950 text-xs">Authorize Admin via Google</span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                Add any church leader's Gmail below. They can sign in directly from the login home page with the Google button.
              </p>
            </div>

            {/* Add Google Email Form */}
            <form onSubmit={handleAddAdminEmail} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Enter administrator's Gmail..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white shadow-2xs"
                />
              </div>
              <button
                type="submit"
                disabled={addingEmail || !newAdminEmail}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shadow-xs shadow-indigo-600/20 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> <span>{addingEmail ? 'Adding...' : 'Authorize'}</span>
              </button>
            </form>

            {/* Primary Admin Card */}
            {primaryAdminEmail && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                      <GoogleIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs text-indigo-950 block truncate">{primaryAdminEmail}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-tight bg-indigo-600 text-white shrink-0">
                          Primary Owner
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-700/80 font-medium">Root admin account</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferOwnerBox(prev => !prev);
                      setTargetOwnerEmail('');
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-100/70 border border-indigo-200 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs shrink-0 self-end sm:self-center"
                    title="Transfer Primary Account Ownership"
                  >
                    <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                    <span>Transfer</span>
                  </button>
                </div>

                {/* Transfer Ownership Box */}
                {showTransferOwnerBox && (
                  <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 space-y-2 shadow-2xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-600" />
                        <span>Transfer Primary Ownership</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTransferOwnerBox(false)}
                        className="p-1 rounded text-amber-700 hover:text-amber-950 hover:bg-amber-100/60 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-amber-900 leading-tight">
                      Current owner (<strong className="font-mono">{primaryAdminEmail}</strong>) will remain an authorized administrator.
                    </p>

                    <div className="space-y-1.5">
                      {googleEmails.filter(i => i.email !== primaryAdminEmail).length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9.5px] font-bold text-amber-900/80 uppercase block">
                            Choose from Authorized Admins:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {googleEmails
                              .filter(i => i.email !== primaryAdminEmail)
                              .map(item => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleTransferOwner(item.email)}
                                  disabled={transferringOwner}
                                  className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Crown className="w-3 h-3 text-amber-500" />
                                  <span>{item.email}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-1.5 pt-1">
                        <input
                          type="email"
                          value={targetOwnerEmail}
                          onChange={(e) => setTargetOwnerEmail(e.target.value)}
                          placeholder="Or enter new owner Gmail..."
                          className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs text-slate-900 placeholder-amber-400 focus:outline-none focus:border-amber-600 shadow-2xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleTransferOwner(targetOwnerEmail)}
                          disabled={transferringOwner || !targetOwnerEmail}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shadow-xs shadow-amber-600/20 shrink-0"
                        >
                          <Check className="w-3 h-3" />
                          <span>{transferringOwner ? 'Transferring...' : 'Transfer'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Authorized Admins List */}
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Secondary Authorized Admins ({googleEmails.filter(i => i.email !== primaryAdminEmail).length})
              </span>

              {loadingGoogleEmails ? (
                <div className="py-6 text-center text-xs text-indigo-600 font-bold animate-pulse">
                  Loading authorized Google emails...
                </div>
              ) : googleEmails.filter(i => i.email !== primaryAdminEmail).length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                  No secondary Google admin accounts added yet.
                </div>
              ) : (
                googleEmails
                  .filter(i => i.email !== primaryAdminEmail)
                  .map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <GoogleIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-xs text-slate-900 block truncate">
                            {item.email}
                          </span>
                          <span className="text-[9.5px] text-slate-400">
                            Authorized Admin • Google Login
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAdminEmail(item.id, item.email)}
                        className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title={`Revoke admin privileges for ${item.email}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
