import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, ArrowRight, ShieldCheck, Users, Eye, EyeOff, KeyRound, Sparkles, AlertCircle, CheckCircle2, Settings, ExternalLink, X } from 'lucide-react';
import { api, setAuthToken, setAuthUser } from '../utils/api';
import churchLogo from '../assets/church_logo.jpg';

function GoogleLogoSvg({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function Login({ onLoginSuccess, showToast }) {
  // Tab state: 'user' for Bial credentials, 'admin' for Google login
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'admin'

  // User Credentials Login State
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  // Admin Credentials Fallback State (if offline or during setup)
  const [showAdminCredFallback, setShowAdminCredFallback] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminCredLoading, setAdminCredLoading] = useState(false);

  // Google Login State
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [configuredClientId, setConfiguredClientId] = useState(() => {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('pathian_ram_google_client_id') || '';
  });
  const [inputClientId, setInputClientId] = useState(configuredClientId);
  const [directAdminEmail, setDirectAdminEmail] = useState('');

  const googleBtnContainerRef = useRef(null);

  // 1. Initialize Google Identity Services when Client ID is available
  useEffect(() => {
    if (!configuredClientId) return;

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: configuredClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'signin_with',
              logo_alignment: 'left',
              width: 320
            });
          }
        } catch (e) {
          console.warn('Google Sign-In initialization note:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const timer = setTimeout(initGoogle, 800);
      return () => clearTimeout(timer);
    }
  }, [configuredClientId, activeTab]);

  // 2. Handle Google Credential Response from Google Identity Services
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      showToast('Google did not return credentials. Please try again.', 'error');
      return;
    }

    try {
      setGoogleLoading(true);
      const res = await api.googleLogin({ credential: response.credential });

      setAuthToken(res.token);
      setAuthUser(res.user);

      showToast(`Welcome Admin! Authenticated as ${res.user.email || res.user.username}`, 'success');
      onLoginSuccess(res.user);
    } catch (err) {
      showToast(err.message || 'Google Admin authentication failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  // 3. Trigger Google Sign-In button click
  const handleGoogleSignInClick = () => {
    if (configuredClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // If prompt was dismissed or not displayed, open config/help modal
            setShowGoogleConfigModal(true);
          }
        });
      } catch (err) {
        setShowGoogleConfigModal(true);
      }
    } else {
      // If client ID is not yet configured, show helper modal
      setShowGoogleConfigModal(true);
    }
  };

  // 4. Handle Direct Admin Email Sign-in (for instant testing or pre-configured email)
  const handleDirectEmailSignIn = async (e) => {
    e.preventDefault();
    if (!directAdminEmail.trim() || !directAdminEmail.includes('@')) {
      showToast('Please enter a valid Google email address', 'error');
      return;
    }

    try {
      setGoogleLoading(true);
      const res = await api.googleLogin({
        email: directAdminEmail.trim().toLowerCase()
      });

      setAuthToken(res.token);
      setAuthUser(res.user);

      setShowGoogleConfigModal(false);
      showToast(`Welcome Admin! Signed in as ${res.user.email || res.user.username}`, 'success');
      onLoginSuccess(res.user);
    } catch (err) {
      showToast(err.message || 'Google Admin authentication failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  // 5. Save Client ID from config modal
  const handleSaveClientId = () => {
    const cleanId = inputClientId.trim();
    if (cleanId) {
      localStorage.setItem('pathian_ram_google_client_id', cleanId);
      setConfiguredClientId(cleanId);
      showToast('Google Client ID saved! Google Sign-in is now active.', 'success');
    } else {
      localStorage.removeItem('pathian_ram_google_client_id');
      setConfiguredClientId('');
      showToast('Google Client ID cleared.', 'info');
    }
    setShowGoogleConfigModal(false);
  };

  // 6. Handle User (Bial Credentials) Login
  const handleUserLogin = async (e) => {
    e.preventDefault();
    if (!userUsername.trim() || !userPassword) return;

    try {
      setUserLoading(true);
      const res = await api.login({
        username: userUsername.trim(),
        password: userPassword
      });

      setAuthToken(res.token);
      setAuthUser(res.user);

      showToast(`Welcome back, ${res.user.bial_name || res.user.username}!`, 'success');
      onLoginSuccess(res.user);
    } catch (err) {
      showToast(err.message || 'User login failed. Please check credentials.', 'error');
    } finally {
      setUserLoading(false);
    }
  };

  // 7. Handle Admin Credentials Fallback Login
  const handleAdminCredLogin = async (e) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword) return;

    try {
      setAdminCredLoading(true);
      const res = await api.login({
        username: adminUsername.trim(),
        password: adminPassword
      });

      if (res.user.role !== 'ADMIN') {
        showToast('These credentials do not have Admin privileges. Please use User Login.', 'error');
        return;
      }

      setAuthToken(res.token);
      setAuthUser(res.user);

      showToast('Welcome Admin!', 'success');
      onLoginSuccess(res.user);
    } catch (err) {
      showToast(err.message || 'Admin login failed. Check credentials.', 'error');
    } finally {
      setAdminCredLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden text-slate-900">
      {/* Ambient Glowing Background Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header with Logo at top */}
        <div className="text-center mb-6">
          <img
            src={churchLogo}
            alt="Bethlehem Kohhran Logo"
            className="w-22 h-22 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-amber-600/30 object-contain shadow-xl mx-auto mb-3 p-1 transform hover:scale-105 transition-transform duration-300"
          />
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight leading-tight">
            Bethlehem Kohhran
          </h1>
          <p className="text-sm sm:text-base text-indigo-700 font-extrabold tracking-wider uppercase mt-1">
            Pathian Ram Khawnna
          </p>
        </div>

        {/* Login Container Box */}
        <div className="glass-panel-elevated p-5 sm:p-7 rounded-3xl border border-slate-200 shadow-2xl bg-white/90 backdrop-blur-md">
          
          {/* SEPARATE LOGIN OPTION TABS */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/90 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('user')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'user'
                  ? 'bg-white text-indigo-900 shadow-md border border-slate-200/80 scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'user' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>User Login</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'user' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                Credentials
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-indigo-900 shadow-md border border-slate-200/80 scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Admin Login</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${activeTab === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                <GoogleLogoSvg className="w-2.5 h-2.5" /> Google
              </span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: USER / BIAL IN-CHARGE CREDENTIALS LOGIN            */}
          {/* ======================================================== */}
          {activeTab === 'user' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider mb-1">
                  <KeyRound className="w-3 h-3 text-blue-600" /> Bial In-Charge Credentials
                </span>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Sign in with the username & password created for your Bial by Kohhran Admin.
                </p>
              </div>

              <form onSubmit={handleUserLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={userUsername}
                      onChange={(e) => setUserUsername(e.target.value)}
                      placeholder="e.g. bial1, Puia, Ruatsaka"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm font-medium transition-all shadow-xs"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showUserPassword ? "text" : "password"}
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Enter your Bial password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm font-medium transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserPassword(p => !p)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showUserPassword ? "Hide password" : "Show password"}
                    >
                      {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={userLoading}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {userLoading ? (
                    'Verifying Credentials...'
                  ) : (
                    <>
                      <span>Sign In with Credentials</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100">
                <p className="text-[11px] text-slate-500">
                  New collector or forgot password? Contact <span className="font-bold text-slate-700">Kohhran Admin</span>.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: ADMIN GOOGLE LOGIN OPTION                         */}
          {/* ======================================================== */}
          {activeTab === 'admin' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 uppercase tracking-wider mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Kohhran Admin Portal
                </span>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Protected administrative access. Sign in securely using your authorized Google Account.
                </p>
              </div>

              {/* PRIMARY OPTION: GOOGLE SIGN-IN BUTTON */}
              <div className="space-y-3">
                {/* Official Google Identity Services Container if initialized */}
                <div ref={googleBtnContainerRef} className="flex justify-center w-full min-h-[44px]"></div>

                {/* Primary Fallback/Custom Styled Google Sign-In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignInClick}
                  disabled={googleLoading}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-2xl shadow-sm hover:shadow-md text-slate-800 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
                >
                  {googleLoading ? (
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <GoogleLogoSvg className="w-5 h-5 shrink-0" />
                  )}
                  <span>Sign in with Google</span>
                </button>

                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span className="text-slate-400">Authorized Admin Accounts only</span>
                  <button
                    type="button"
                    onClick={() => setShowGoogleConfigModal(true)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Setup / Test</span>
                  </button>
                </div>
              </div>

              {/* SECONDARY OPTION: ADMIN CREDENTIALS FALLBACK (Password failsafe) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-center mb-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminCredFallback(prev => !prev)}
                    className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showAdminCredFallback ? 'Hide password sign-in' : 'Or sign in with Admin password fallback'}</span>
                  </button>
                </div>

                {showAdminCredFallback && (
                  <form onSubmit={handleAdminCredLogin} className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Admin Username
                      </label>
                      <input
                        type="text"
                        required
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          type={showAdminPassword ? "text" : "password"}
                          required
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Enter admin password"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(p => !p)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={adminCredLoading}
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-900 text-white transition-all cursor-pointer"
                    >
                      {adminCredLoading ? 'Authenticating...' : 'Sign In as Admin'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ======================================================== */}
      {/* GOOGLE SIGN-IN SETUP & DIRECT EMAIL VERIFICATION MODAL    */}
      {/* ======================================================== */}
      {showGoogleConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GoogleLogoSvg className="w-5 h-5" />
                <h3 className="font-heading font-black text-sm sm:text-base text-slate-900">
                  Google Admin Authentication
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleConfigModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Email Direct Sign-In (Great for initial admin setup & instant testing) */}
            <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 space-y-2.5">
              <span className="text-[11px] font-extrabold uppercase text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Quick Admin Google Verification
              </span>
              <p className="text-xs text-indigo-950/80 leading-relaxed">
                Sign in with your Admin Google email. The first admin email used will automatically become the church’s Primary Google Admin account.
              </p>

              <form onSubmit={handleDirectEmailSignIn} className="space-y-2">
                <input
                  type="email"
                  value={directAdminEmail}
                  onChange={(e) => setDirectAdminEmail(e.target.value)}
                  placeholder="e.g. pastor@gmail.com or admin@church.org"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-indigo-300 text-xs font-mono font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={googleLoading}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  {googleLoading ? 'Verifying...' : 'Authenticate Google Admin Email'}
                </button>
              </form>
            </div>

            {/* OAuth Client ID Configuration */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-extrabold uppercase text-slate-600 block">
                Google OAuth Client ID (Optional / Production)
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                For Google's official one-click popup button, paste your Google Cloud OAuth Client ID below:
              </p>
              <input
                type="text"
                value={inputClientId}
                onChange={(e) => setInputClientId(e.target.value)}
                placeholder="xxxxxx.apps.googleusercontent.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowGoogleConfigModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveClientId}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Save Client ID
                </button>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
              <span>Google Cloud Console → Credentials</span>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                Open Console <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
