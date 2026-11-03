import React, { useState } from 'react';
import { Lock, User, ArrowRight } from 'lucide-react';
import { api, setAuthToken, setAuthUser } from '../utils/api';
import churchLogo from '../assets/church_logo.jpg';

export default function Login({ onLoginSuccess, showToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    try {
      setLoading(true);
      const res = await api.login({
        username: username.trim(),
        password
      });

      setAuthToken(res.token);
      setAuthUser(res.user);

      showToast(`Welcome back, ${res.user.bial_name || res.user.username}!`, 'success');
      onLoginSuccess(res.user);
    } catch (err) {
      showToast(err.message || 'Login failed. Please check credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 relative overflow-hidden text-slate-900">
      {/* Ambient Glowing Background Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header with Logo at top */}
        <div className="text-center mb-6">
          <img
            src={churchLogo}
            alt="Church Logo"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-2 border-amber-600/30 object-contain shadow-xl mx-auto mb-4 p-1 transform hover:scale-105 transition-transform duration-300"
          />
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight leading-tight">
            Bethlehem Kohhran
          </h1>
          <p className="text-base sm:text-lg text-indigo-700 font-extrabold tracking-wider uppercase mt-1">
            Pathian Ram Khawnna
          </p>
        </div>

        {/* Login Form Panel */}
        <div className="glass-panel-elevated p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm transition-all shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm transition-all shadow-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                'Authenticating...'
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
