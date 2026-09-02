import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldCheck, MapPin, ArrowRight, AlertCircle, Sparkles, Building2, Languages } from 'lucide-react';
import { User as UserType } from '../types';
import { useTranslation } from '../utils/translations';

interface LoginScreenProps {
  onLoginSuccess: (user: UserType) => void;
  lang?: 'en' | 'hi';
  onToggleLang?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLoginSuccess,
  lang = 'en',
  onToggleLang
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'granted' | 'prompt'>('prompt');
  const t = useTranslation(lang);

  // Load saved credentials & sync persistent device fingerprint
  useEffect(() => {
    const savedId = localStorage.getItem('staffsync_saved_id');
    const savedPwd = localStorage.getItem('staffsync_saved_pwd');
    if (savedId) setIdentifier(savedId);
    if (savedPwd) setPassword(savedPwd);

    // Ensure persistent unique hardware fingerprint exists
    let deviceId = localStorage.getItem('staffsync_device_fingerprint');
    if (!deviceId) {
      deviceId = `dev_\${Math.random().toString(36).substring(2, 9)}_\${Date.now()}`;
      localStorage.setItem('staffsync_device_fingerprint', deviceId);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setGpsStatus('granted'),
        () => setGpsStatus('prompt'),
        { timeout: 5000 }
      );
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Please enter your Employee ID / Email and Password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Forward consistent deviceId to backend
    let deviceId = localStorage.getItem('staffsync_device_fingerprint');
    if (!deviceId) {
      deviceId = `dev_\${Math.random().toString(36).substring(2, 9)}_\${Date.now()}`;
      localStorage.setItem('staffsync_device_fingerprint', deviceId);
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-id': deviceId
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: password.trim(),
          deviceId: deviceId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMsg(data.message || 'Invalid credentials. Please check and try again.');
        setLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('staffsync_saved_id', identifier.trim());
        localStorage.setItem('staffsync_saved_pwd', password.trim());
      } else {
        localStorage.removeItem('staffsync_saved_id');
        localStorage.removeItem('staffsync_saved_pwd');
      }

      localStorage.setItem('staffsync_current_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg('Network error connecting to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between p-4 sm:p-6 select-none font-sans">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto flex items-center justify-between pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-600 shadow-xs">
          <MapPin className={`w-3.5 h-3.5 \${gpsStatus === 'granted' ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span>{gpsStatus === 'granted' ? 'GPS Location Ready' : 'Location Required for Attendance'}</span>
        </div>

        {onToggleLang && (
          <button
            id="login-toggle-lang-btn"
            onClick={onToggleLang}
            className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Languages className="w-3.5 h-3.5 text-blue-600" />
            <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
          </button>
        )}
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto my-auto bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3 border border-blue-400/20">
            <Building2 className="w-7 h-7 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Rudra Infra World
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise Workforce & Attendance Portal
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('employee_id_email')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="login-identifier-input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. EMP-1001 or ADMIN-01"
                required
                className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 hover:text-slate-800">
              <input
                id="login-remember-me-checkbox"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>{t('remember_me')}</span>
            </label>
            <span className="text-[11px] text-slate-400">Saved on Device</span>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Signing in...</span>
              </span>
            ) : (
              <>
                <span>{t('login_button')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="relative z-10 text-center pt-4 pb-2">
        <p className="text-[11px] text-slate-500 font-normal tracking-wide">
          Designed & Developed by <span className="text-slate-700 font-semibold">Abhishek Bhatt</span>
        </p>
      </div>
    </div>
  );
};
