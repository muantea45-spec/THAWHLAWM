import React, { useState, useEffect } from 'react';
import { Key, Plus, Lock, Unlock, Trash2, Edit, Search, ShieldCheck, Check, X, RefreshCw, Mail, Users, Sparkles, Crown, ArrowRightLeft } from 'lucide-react';
import Modal from './common/Modal';
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

export default function BialCredentialsModal({
  isOpen,
  onClose,
  bials,
  onRefresh,
  onEditBial,
  onAddNewBial,
  showToast,
  initialSection = 'bials'
}) {
  const [activeSection, setActiveSection] = useState(initialSection);
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
    if (isOpen) {
      setActiveSection(initialSection || 'bials');
    }
  }, [isOpen, initialSection]);

  useEffect(() => {
    if (isOpen && activeSection === 'admin_google') {
      fetchGoogleEmails();
    }
  }, [isOpen, activeSection]);

  const fetchGoogleEmails = async () => {
    try {
      setLoadingGoogleEmails(true);
      const res = await api.getAdminGoogleEmails();
      setGoogleEmails(res.emails || []);
      setPrimaryAdminEmail(res.primaryAdminEmail || null);
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
    const targetEmail = (emailToSet || targetOwnerEmail).trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      if (showToast) showToast('Please enter or select a valid email address', 'error');
      return;
    }

    if (targetEmail === primaryAdminEmail?.toLowerCase()) {
      if (showToast) showToast(`${targetEmail} is already the Primary Account Owner`, 'info');
      setShowTransferOwnerBox(false);
      return;
    }

    if (!window.confirm(`Transfer Primary Account Ownership to ${targetEmail}?\n\nThe current owner (${primaryAdminEmail}) will remain an authorized administrator.`)) {
      return;
    }

    try {
      setTransferringOwner(true);
      const res = await api.setPrimaryAdminOwner(targetEmail);
      if (showToast) showToast(res?.message || `Primary Account Owner changed to ${targetEmail}`, 'success');
      setShowTransferOwnerBox(false);
      setTargetOwnerEmail('');
      await fetchGoogleEmails();
      onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to change primary owner', 'error');
    } finally {
      setTransferringOwner(false);
    }
  };

  const filteredBials = bials.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const secondaryGoogleAdmins = googleEmails.filter(i => {
    const email = (typeof i === 'string' ? i : i.email || '').toLowerCase();
    return email && email !== (primaryAdminEmail || '').toLowerCase();
  });

  const activeGoogleAdminsCount = (primaryAdminEmail ? 1 : 0) + secondaryGoogleAdmins.length;

  const handleToggleStatus = async (bial) => {
    const newStatus = bial.status === 'active' ? 'locked' : 'active';
    try {
      await api.updateBial(bial.id, { status: newStatus });
      if (showToast) showToast(`Account ${bial.name} ${newStatus === 'locked' ? 'Locked' : 'Unlocked'}`, 'success');
      onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to toggle account status', 'error');
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <Modal.Header
        title={activeSection === 'admin_google' ? "Make Another Admin (Google Login)" : "Bial User Passwords & Credentials"}
        subtitle={activeSection === 'admin_google' 
          ? "Authorize church administrators to sign in using Google Mail on the login home page" 
          : "Manage login credentials and reset passwords for Bial collectors"}
        icon={activeSection === 'admin_google' ? ShieldCheck : Key}
        onClose={onClose}
      />

      <Modal.Body className="space-y-3">
        {/* SECTION NAVIGATION TABS */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSection('admin_google')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'admin_google'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Manage Admins (Google Logins)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('bials')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'bials'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-600" />
            <span>Bial User Passwords ({bials.length})</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* SECTION 1: BIAL USER CREDENTIALS                         */}
        {/* ======================================================== */}
        {activeSection === 'bials' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Bial name, code, username..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 shadow-2xs"
                />
              </div>

              <button
                onClick={() => {
                  onClose();
                  onAddNewBial();
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> <span>Add Bial User</span>
              </button>
            </div>

            {/* Credentials List */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
              {filteredBials.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-sans">
                  No Bial accounts found matching your search.
                </div>
              ) : (
                filteredBials.map((b, index) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors shadow-2xs space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2 min-w-0">
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
                            <span>User:</span>
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
                          onClick={() => {
                            onClose();
                            onEditBial(b);
                          }}
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
        {/* SECTION 2: AUTHORIZED ADMIN GOOGLE LOGINS                */}
        {/* ======================================================== */}
        {activeSection === 'admin_google' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Header Callout */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-indigo-50/90 rounded-2xl border border-indigo-200/90 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-600/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Make Another Admin via Google Login</h4>
                  <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                    Authorize any church leader or administrator by entering their Google email below. They can immediately log in from the app homepage using the <strong>"Sign in with Google"</strong> button.
                  </p>
                </div>
              </div>
            </div>

            {/* Form to Add Authorized Google Email */}
            <form onSubmit={handleAddAdminEmail} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Enter administrator's Gmail (e.g. pastor@gmail.com)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                />
              </div>
              <button
                type="submit"
                disabled={addingEmail || !newAdminEmail}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs shadow-indigo-600/20 shrink-0"
              >
                <Plus className="w-4 h-4" /> <span>{addingEmail ? 'Authorizing...' : 'Authorize Admin'}</span>
              </button>
            </form>

            {/* List of Authorized Google Emails */}
            <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-0.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block">
                  Authorized Church Administrators ({activeGoogleAdminsCount})
                </span>
                <span className="text-[10px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Full Admin Rights
                </span>
              </div>

              {/* Primary Admin account if linked */}
              {primaryAdminEmail && (
                <div className="space-y-2">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-50/80 border border-indigo-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                        <GoogleIcon className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs sm:text-sm text-indigo-950 block truncate">{primaryAdminEmail}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-tight bg-indigo-600 text-white shrink-0">
                            Primary Owner
                          </span>
                        </div>
                        <span className="text-[10px] text-indigo-700/90 font-medium">Root church administrator account</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowTransferOwnerBox(prev => !prev);
                        setTargetOwnerEmail('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100/70 border border-indigo-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0 self-end sm:self-center"
                      title="Change or transfer primary account ownership"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Change Owner</span>
                    </button>
                  </div>

                  {/* Transfer Ownership Box */}
                  {showTransferOwnerBox && (
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 space-y-2.5 shadow-2xs animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-amber-600" />
                          <span>Change Primary Account Owner</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTransferOwnerBox(false)}
                          className="p-1 rounded text-amber-700 hover:text-amber-950 hover:bg-amber-100/60 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        Select an existing authorized admin or enter a new Google email address. The current owner (<strong className="font-mono">{primaryAdminEmail}</strong>) will stay as an authorized administrator.
                      </p>

                      <div className="space-y-2">
                        {secondaryGoogleAdmins.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-amber-900/80 uppercase block">
                              Option A: Choose from Authorized Admins:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {secondaryGoogleAdmins.map(item => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleTransferOwner(item.email)}
                                  disabled={transferringOwner}
                                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Crown className="w-3 h-3 text-amber-500" />
                                  <span>{item.email}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-900/80 uppercase block">
                            {secondaryGoogleAdmins.length > 0 ? 'Option B: Or Enter Another Gmail:' : 'Enter New Owner Gmail:'}
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={targetOwnerEmail}
                              onChange={(e) => setTargetOwnerEmail(e.target.value)}
                              placeholder="e.g. newpastor@gmail.com"
                              className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-900 placeholder-amber-400 focus:outline-none focus:border-amber-600 shadow-2xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleTransferOwner(targetOwnerEmail)}
                              disabled={transferringOwner || !targetOwnerEmail}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs shadow-amber-600/20 shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{transferringOwner ? 'Transferring...' : 'Confirm Transfer'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {loadingGoogleEmails ? (
                <div className="py-6 text-center text-xs text-indigo-600 font-bold animate-pulse">
                  Loading authorized Google emails...
                </div>
              ) : secondaryGoogleAdmins.length === 0 && !primaryAdminEmail ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                  <p className="text-xs text-slate-600 font-medium">No Google accounts linked yet.</p>
                  <p className="text-[11px] text-slate-400">
                    The first Google account to sign in on the Login homepage will automatically become the Primary Admin account.
                  </p>
                </div>
              ) : (
                secondaryGoogleAdmins
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-between shadow-2xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                          <GoogleIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-xs text-slate-900 block truncate">{item.email}</span>
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            Authorized Admin
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTransferOwner(item.email)}
                          disabled={transferringOwner}
                          className="px-2 py-1 rounded-lg text-[10.5px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Transfer Primary Account Ownership to this email"
                        >
                          <Crown className="w-3 h-3 text-amber-600" />
                          <span>Make Owner</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAdminEmail(item.id, item.email)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Revoke Admin Access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* How-It-Works Step-by-Step Guide */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                How the new Admin logs in:
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-600">
                <li>Authorize their Gmail address above and click <strong>"Authorize Admin"</strong>.</li>
                <li>Send them the web application link: <span className="font-mono text-indigo-700 font-bold select-all">https://thawhlawmptr.pages.dev</span></li>
                <li>On the login homepage, they simply click the black <strong>"Sign in with Google"</strong> button.</li>
                <li>They choose their authorized Google account and will be signed into the Admin Console instantly!</li>
              </ol>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
        >
          Close
        </button>
      </Modal.Footer>
    </Modal>
  );
}
