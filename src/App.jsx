import React, { useState, useEffect } from 'react';
import { getAuthUser, getAuthToken, setAuthToken, setAuthUser, api } from './utils/api';
import Navbar from './components/Navbar';
import Toast from './components/Toast';

const Login = React.lazy(() => import('./pages/Login'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const BialDashboard = React.lazy(() => import('./pages/BialDashboard'));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Uncaught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-800">
          <div className="max-w-md w-full bg-white p-6 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-black text-slate-900">Application Error</h2>
            <p className="text-xs text-slate-600">
              An unexpected error occurred while loading this page. Resetting session data will restore access.
            </p>
            <div className="text-[11px] text-rose-700 font-mono bg-rose-50 p-3 rounded-xl border border-rose-200 text-left overflow-x-auto max-h-28">
              {this.state.error?.toString() || 'Render exception'}
            </div>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20"
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [user, setUser] = useState(() => getAuthUser());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const updateUserWithTransition = (newUser) => {
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(() => {
        setUser(newUser);
      });
    } else {
      setUser(newUser);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const token = getAuthToken();
      if (!token) {
        updateUserWithTransition(null);
        setAuthUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await api.me();
        if (res && res.user) {
          updateUserWithTransition(res.user);
          setAuthUser(res.user);
        } else {
          updateUserWithTransition(null);
          setAuthToken(null);
          setAuthUser(null);
        }
      } catch (err) {
        console.error('Session check failed:', err);
        updateUserWithTransition(null);
        setAuthToken(null);
        setAuthUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogout = () => {
    updateUserWithTransition(null);
    setAuthToken(null);
    setAuthUser(null);
    showToast('Logged out successfully', 'info');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-700">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto shadow-lg shadow-indigo-600/20"></div>
          <p className="text-xs font-bold tracking-widest uppercase text-indigo-600">Loading Pathian Ram...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <Login onLoginSuccess={(u) => updateUserWithTransition(u)} showToast={showToast} />
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'info' })}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        user={user}
        onLogout={handleLogout}
        showToast={showToast}
      />

      <main className="flex-1">
        <React.Suspense
          fallback={
            <div className="min-h-[50vh] flex items-center justify-center">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {user.role === 'ADMIN' ? (
            <AdminDashboard user={user} showToast={showToast} />
          ) : (
            <BialDashboard user={user} showToast={showToast} />
          )}
        </React.Suspense>
      </main>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}



