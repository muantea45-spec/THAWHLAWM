import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, ArrowRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
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
              theme: 'filled_black',
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

  // Mobile Scroll Lock & Swipe-Down-to-Refresh Controller
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0, active: false });
  const PULL_THRESHOLD = 60;

  // Disable root window scroll on mobile while Login screen is active
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'manipulation';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
    };
  }, []);

  const handleTouchStart = (e) => {
    if (isRefreshing) return;
    // Don't intercept touches if user is interacting with text inputs or buttons
    if (e.target.closest('input, button, a')) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: true
    };
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current.active || isRefreshing) return;

    const touch = e.touches[0];
    const diffY = touch.clientY - touchStartRef.current.y;
    const diffX = touch.clientX - touchStartRef.current.x;

    // Only handle vertical drags
    if (Math.abs(diffY) > Math.abs(diffX)) {
      if (diffY > 0) {
        // Swiping DOWN: Pull-to-refresh
        const resistance = Math.min(95, Math.pow(diffY, 0.85) * 1.4);
        setPullY(resistance);
        if (e.cancelable) e.preventDefault();
      } else {
        // Swiping UP: Scrolling down is disabled completely
        if (e.cancelable) e.preventDefault();
        setPullY(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current.active || isRefreshing) return;
    touchStartRef.current.active = false;

    if (pullY >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullY(50);
      try {
        if (navigator.vibrate) navigator.vibrate(25);
      } catch (err) {}
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } else {
      setPullY(0);
    }
  };

  return (
    <div
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-end sm:justify-center items-center px-4 pb-8 sm:pb-6 pt-2 sm:pt-6 overflow-hidden bg-[#030d21] bg-no-repeat bg-[position:center_top] sm:bg-center bg-[length:100%_auto] sm:bg-contain select-none"
      style={{ backgroundImage: `url(${loginBg})` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Mobile Swipe-Down-to-Refresh Indicator */}
      <div
        className="sm:hidden fixed top-0 left-0 right-0 z-50 flex flex-col items-center justify-center pointer-events-none transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${isRefreshing ? 24 : pullY > 5 ? Math.min(65, pullY) : -70}px)`,
          opacity: pullY > 8 || isRefreshing ? 1 : 0
        }}
      >
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-2">
          <RefreshCw
            className={`w-3.5 h-3.5 text-amber-300 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: !isRefreshing ? `rotate(${pullY * 4.5}deg)` : undefined
            }}
          />
          <span className="text-[11px] text-slate-200 font-medium tracking-wide">
            {isRefreshing
              ? 'Refreshing...'
              : pullY >= PULL_THRESHOLD
              ? 'Release to refresh'
              : 'Swipe down to refresh'}
          </span>
        </div>
      </div>
      {/* Ambient background blur for widescreen desktop displays */}
      <div
        className="hidden sm:block absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-105 pointer-events-none"
        style={{ backgroundImage: `url(${loginBg})` }}
      />

      {/* Subtle Contrast Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030d21]/60 via-transparent to-[#030d21]/85 pointer-events-none"></div>

      <div className="w-full max-w-sm sm:max-w-md relative z-10 flex flex-col items-center">
        {/* Brand Header: Logo and Bethlehem Kohhran Pathian Ram Chhiarna */}
        <div className="text-center mb-3 w-full">
          <div className="inline-flex items-center justify-center gap-3 bg-slate-950/60 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-2xl border border-white/10 sm:border-0 backdrop-blur-md sm:backdrop-blur-none shadow-sm sm:shadow-none">
            <img
              src={churchLogo}
              alt="Bethlehem Kohhran Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-white/30 shadow-sm shrink-0"
            />
            <div className="text-center flex flex-col items-center justify-center">
              <h1 className="font-heading font-bold text-sm sm:text-base text-white tracking-[0.06em] uppercase leading-tight text-center whitespace-nowrap">
                BETHLEHEM KOHHRAN
              </h1>
              <p className="font-heading font-medium text-[10px] sm:text-xs text-amber-200/90 tracking-[0.14em] uppercase text-center whitespace-nowrap mt-0.5">
                PATHIAN RAM CHHIARNA
              </p>
            </div>
          </div>
        </div>

        {/* Quiet, Reverent Glass Login Box */}
        <div className="w-full p-4 sm:p-5 rounded-2xl border border-white/15 shadow-xl bg-slate-950/70 backdrop-blur-xl select-auto">
          
          {/* ======================================================== */}
          {/* 1. UPPER PART: REGULAR LOGIN (BIAL VAWNGTU TAN)           */}
          {/* ======================================================== */}
          <div className="text-center mb-2.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-widest">
              Bial Vawngtu Tan
            </span>
          </div>

          <form onSubmit={handleUserLogin} className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/15 focus:border-slate-300 focus:ring-1 focus:ring-slate-300 text-white placeholder-slate-400 text-xs sm:text-sm transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showUserPassword ? "text" : "password"}
                  required
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/15 focus:border-slate-300 focus:ring-1 focus:ring-slate-300 text-white placeholder-slate-400 text-xs sm:text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword(p => !p)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  title={showUserPassword ? "Hide password" : "Show password"}
                >
                  {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={userLoading}
              className="w-full py-2.5 rounded-xl font-semibold text-xs bg-white text-slate-950 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm mt-1"
            >
              {userLoading ? (
                'Signing In...'
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* ======================================================== */}
          {/* DIVIDER                                                  */}
          {/* ======================================================== */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-950/90 border border-white/10 px-2.5 py-0.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider rounded-md">
                or
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. LOWER PART: GOOGLE LOGIN FOR ADMIN (ADMIN TAN)        */}
          {/* ======================================================== */}
          <div className="space-y-2">
            <div className="text-center mb-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-widest">
                Admin Tan
              </span>
            </div>

            {/* Official Google Identity Services Container if Client ID is configured */}
            <div ref={googleBtnContainerRef} className={`flex justify-center w-full min-h-[40px] ${!configuredClientId ? 'hidden' : ''}`}></div>

            {/* Custom Google Sign-In Button (shown when Client ID is not yet saved or fallback) */}
            {!configuredClientId && (
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={googleLoading}
                className="w-full py-2 px-3 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <GoogleLogoSvg className="w-4 h-4 shrink-0" />
                )}
                <span>Sign in with Google</span>
              </button>
            )}
          </div>

        </div>

        {/* Footer info */}
        <div className="text-center mt-3">
          <p className="text-[11px] text-slate-400/90 font-normal">
            Bethlehem Kohhran &bull; Thawhlawm Management System
          </p>
        </div>

      </div>
    </div>
  );
}
