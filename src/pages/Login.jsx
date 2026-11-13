import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api, setAuthToken, setAuthUser } from '../utils/api';
import churchLogo from '../assets/church_logo.jpg';
import loginBg from '../assets/login_bg.jpg';

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
  // User Credentials Login State
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  // Google Login State
  const DEFAULT_GOOGLE_CLIENT_ID = '407051455488-n6bieo72mu6c4v9lm5cbofapq9i81tjo.apps.googleusercontent.com';
  const [googleLoading, setGoogleLoading] = useState(false);
  const [configuredClientId] = useState(() => {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  });

  const googleBtnContainerRef = useRef(null);

  // Initialize Google Identity Services when Client ID is available
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
  }, [configuredClientId]);

  // Handle Google Credential Response from Google Identity Services
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

  // Trigger Google Sign-In click
  const handleGoogleSignInClick = () => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch (err) {
        console.error('Google Sign-In prompt error:', err);
      }
    }
  };

  // Handle User (Credentials) Login
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
      showToast(err.message || 'Login failed. Please check credentials.', 'error');
    } finally {
      setUserLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Background Dark Vignette / Overlay to enhance contrast while keeping church glow vivid */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/40 to-slate-950/80 backdrop-blur-[1px] pointer-events-none"></div>

      {/* Subtle Warm Amber & Cool Indigo Ambient Highlights */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/4 w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header with Logo at top */}
        <div className="text-center mb-6">
          <img
            src={churchLogo}
            alt="Bethlehem Kohhran Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/95 border-2 border-white/80 object-contain shadow-2xl mx-auto mb-3 p-1 ring-4 ring-white/20 transform hover:scale-105 transition-transform duration-300"
          />
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
            Bethlehem Kohhran
          </h1>
          <p className="text-sm sm:text-base text-amber-300 font-extrabold tracking-wider uppercase mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
            Pathian Ram Khawnna
          </p>
        </div>

        {/* Slightly Transparent / Frosted Glass Login Box */}
        <div className="p-6 sm:p-8 rounded-3xl border border-white/40 shadow-[0_20px_60px_rgba(0,0,0,0.45)] bg-white/75 backdrop-blur-xl transition-all">
          
          {/* ======================================================== */}
          {/* 1. UPPER PART: USER CREDENTIALS LOGIN                     */}
          {/* ======================================================== */}
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
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 hover:bg-white focus:bg-white border border-slate-300/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-sm font-medium transition-all shadow-xs"
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
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/80 hover:bg-white focus:bg-white border border-slate-300/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 text-sm font-medium transition-all shadow-xs"
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
              className="w-full py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-lg shadow-indigo-700/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {userLoading ? (
                'Signing In...'
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* ======================================================== */}
          {/* DIVIDER                                                  */}
          {/* ======================================================== */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300/70"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white/80 backdrop-blur-sm px-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider rounded-full">
                OR
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. LOWER PART: GOOGLE LOGIN FOR ADMIN (JUST BELOW IT)     */}
          {/* ======================================================== */}
          <div className="space-y-2.5">
            {/* Official Google Identity Services Container if Client ID is configured */}
            <div ref={googleBtnContainerRef} className={`flex justify-center w-full min-h-[44px] ${!configuredClientId ? 'hidden' : ''}`}></div>

            {/* Custom Google Sign-In Button (shown when Client ID is not yet saved or fallback) */}
            {!configuredClientId && (
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={googleLoading}
                className="w-full py-3 px-4 bg-white/90 hover:bg-white border-2 border-slate-200 hover:border-slate-300 rounded-2xl shadow-xs hover:shadow-md text-slate-800 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
              >
                {googleLoading ? (
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <GoogleLogoSvg className="w-5 h-5 shrink-0" />
                )}
                <span>Sign in with Google (Admin)</span>
              </button>
            )}
          </div>

        </div>

        {/* Footer info */}
        <div className="text-center mt-5">
          <p className="text-xs text-slate-300/80 drop-shadow font-medium">
            Bethlehem Kohhran &bull; Thawhlawm Management System
          </p>
        </div>

      </div>
    </div>
  );
}
