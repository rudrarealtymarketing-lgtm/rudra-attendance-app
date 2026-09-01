import React, { useState } from 'react';
import { Lock, Eye, EyeOff, X, Check, Shield, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { User } from '../types';

interface ChangePasswordModalProps {
  currentUser: User;
  onClose: () => void;
  onPasswordChanged?: (updatedUser: User) => void;
  lang?: 'en' | 'hi';
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  currentUser,
  onClose,
  onPasswordChanged,
  lang = 'en'
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isAdmin = currentUser.role === 'super_admin';
  const isDirector = currentUser.role === 'director';

  const roleLabel = isAdmin 
    ? (lang === 'hi' ? 'सुपर एडमिन' : 'Super Admin')
    : isDirector
    ? (lang === 'hi' ? 'एग्जीक्यूटिव डायरेक्टर' : 'Executive Director')
    : (lang === 'hi' ? 'कर्मचारी' : 'Staff Employee');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword.trim()) {
      setErrorMsg(lang === 'hi' ? 'कृपया नया पासवर्ड दर्ज करें' : 'Please enter a new password');
      return;
    }

    if (newPassword.trim().length < 4) {
      setErrorMsg(lang === 'hi' ? 'पासवर्ड कम से कम 4 अक्षरों का होना चाहिए' : 'Password must be at least 4 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(lang === 'hi' ? 'नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते' : 'New password and confirm password do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/users/${currentUser.id}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(data.message || (lang === 'hi' ? 'पासवर्ड सफलतापूर्वक बदल दिया गया है!' : 'Password updated successfully!'));
        if (data.user && onPasswordChanged) {
          onPasswordChanged(data.user);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setErrorMsg(data.message || (lang === 'hi' ? 'पासवर्ड बदलने में विफल' : 'Failed to update password'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 text-xs font-sans animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${
              isAdmin 
                ? 'bg-amber-600' 
                : isDirector 
                ? 'bg-indigo-600' 
                : 'bg-blue-600'
            }`}>
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {lang === 'hi' ? 'पासवर्ड बदलें' : 'Change Account Password'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'hi' ? 'अपने खाते के लिए सुरक्षित पासवर्ड सेट करें' : 'Update secure sign-in password'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Identity Card */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-xs">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500 font-mono">
                {currentUser.registration_id} {currentUser.username ? `(@${currentUser.username})` : ''}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
            isAdmin 
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              : isDirector
              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
          }`}>
            {roleLabel}
          </span>
        </div>

        {/* Alert / Feedback Messages */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-[11px] flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Current Password */}
          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1 text-[11px]">
              {lang === 'hi' ? 'वर्तमान पासवर्ड (यदि कोई हो)' : 'Current Password (Optional if first time)'}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={lang === 'hi' ? 'वर्तमान पासवर्ड दर्ज करें' : 'Enter current password'}
                className="w-full p-2.5 pr-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1 text-[11px]">
              {lang === 'hi' ? 'नया पासवर्ड *' : 'New Password *'}
            </label>
            <div className="relative">
              <input
                required
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={lang === 'hi' ? 'कम से कम 4 अक्षर' : 'Minimum 4 characters'}
                className="w-full p-2.5 pr-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1 text-[11px]">
              {lang === 'hi' ? 'नए पासवर्ड की पुष्टि करें *' : 'Confirm New Password *'}
            </label>
            <div className="relative">
              <input
                required
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={lang === 'hi' ? 'नया पासवर्ड दोबारा दर्ज करें' : 'Re-enter new password'}
                className="w-full p-2.5 pr-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && confirmPassword && (
              <p className={`mt-1 text-[10px] font-semibold flex items-center gap-1 ${
                newPassword === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              }`}>
                {newPassword === confirmPassword 
                  ? `✓ ${lang === 'hi' ? 'पासवर्ड मेल खाता है' : 'Passwords match'}` 
                  : `✗ ${lang === 'hi' ? 'पासवर्ड मेल नहीं खा रहे' : 'Passwords do not match'}`}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
            >
              {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className={`w-2/3 py-2.5 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 ${
                isAdmin 
                  ? 'bg-amber-600 hover:bg-amber-700' 
                  : isDirector 
                  ? 'bg-indigo-600 hover:bg-indigo-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <span>{lang === 'hi' ? 'सहेज रहे हैं...' : 'Updating Password...'}</span>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'पासवर्ड अपडेट करें' : 'Update Password'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
