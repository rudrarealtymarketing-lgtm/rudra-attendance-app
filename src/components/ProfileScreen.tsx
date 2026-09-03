import React, { useState, useEffect, useRef } from 'react';
import { 
  User as UserIcon, Mail, Phone, MapPin, Building2, Shield, 
  QrCode, LogOut, Camera, CheckCircle2, 
  AlertCircle, Smartphone, Lock, Save, Moon, Sun, Languages, Printer, Calendar,
  KeyRound, Crop, ZoomIn, ZoomOut, Check, X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { User } from '../types';
import { useTranslation } from '../utils/translations';
import { ChangePasswordModal } from './ChangePasswordModal';

interface ProfileScreenProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  lang: 'en' | 'hi';
  onToggleLang: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentUser,
  onLogout,
  onUpdateUser,
  theme,
  onToggleTheme,
  lang,
  onToggleLang
}) => {
  const [email, setEmail] = useState(currentUser.email || '');
  const [currentAddress, setCurrentAddress] = useState(currentUser.current_address || '');
  const [maritalStatus, setMaritalStatus] = useState(currentUser.marital_status || 'Single');
  const [emergencyContact, setEmergencyContact] = useState(currentUser.emergency_contact || '');
  const [dateOfJoining, setDateOfJoining] = useState(currentUser.date_of_joining || '');
  const [dateOfBirth, setDateOfBirth] = useState(currentUser.date_of_birth || '');
  
  // Persistent avatar state from user or localStorage
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return currentUser.avatar_url || localStorage.getItem(`avatar_${currentUser.id}`) || '';
  });
  
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const t = useTranslation(lang);

  // --- INTERACTIVE FACE CROP MODAL STATES ---
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Update avatar state if currentUser prop changes
  useEffect(() => {
    if (currentUser.avatar_url) {
      setAvatarUrl(currentUser.avatar_url);
    }
  }, [currentUser.avatar_url]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/users/${currentUser.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          current_address: currentAddress.trim(),
          marital_status: maritalStatus,
          emergency_contact: emergencyContact.trim(),
          date_of_joining: dateOfJoining || undefined,
          date_of_birth: dateOfBirth || undefined,
          avatar_url: avatarUrl
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Profile updated successfully.');
        localStorage.setItem(`avatar_${currentUser.id}`, avatarUrl);
        const updated = { ...currentUser, ...data.user, avatar_url: avatarUrl };
        onUpdateUser(updated);
        localStorage.setItem('currentUser', JSON.stringify(updated));
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        alert(data.message || 'Failed to update profile');
      }
    } catch (e: any) {
      alert('Error updating profile: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Instant trigger when user picks an image
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setRawImageSrc(result);
          setZoomLevel(1);
          setPanPosition({ x: 0, y: 0 });
          setCropModalOpen(true);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input to allow re-selecting same photo
  };

  // Apply Face Crop: Render square canvas to Base64
  const handleApplyFaceCrop = async () => {
    if (!rawImageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = rawImageSrc;
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const size = 320;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.translate(panPosition.x, panPosition.y);
      ctx.scale(zoomLevel, zoomLevel);

      const minDim = Math.min(img.width, img.height);
      const drawWidth = (img.width / minDim) * size;
      const drawHeight = (img.height / minDim) * size;

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const croppedBase64 = canvas.toDataURL("image/jpeg", 0.88);
      setAvatarUrl(croppedBase64);
      localStorage.setItem(`avatar_${currentUser.id}`, croppedBase64);
      setCropModalOpen(false);
      setRawImageSrc(null);

      // Auto-persist directly to database immediately
      try {
        const res = await fetch(`/api/users/${currentUser.id}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_url: croppedBase64 })
        });
        if (res.ok) {
          const uData = await res.json();
          const merged = { ...currentUser, avatar_url: croppedBase64 };
          onUpdateUser(merged);
          localStorage.setItem('currentUser', JSON.stringify(merged));
        }
      } catch (_) {}
    };
  };

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // Touch drag for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - panPosition.x, y: e.touches[0].clientY - panPosition.y });
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPanPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };
  const handleTouchEnd = () => setIsDragging(false);

  const handlePrintCard = () => {
    const printContent = document.getElementById('printable-id-card');
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=600,height=750');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>ID Card - ${currentUser.name}</title>
            <style>
              body { font-family: -apple-system, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
              .id-card-wrapper { background: white; border: 2px solid #0f172a; border-radius: 20px; padding: 24px; max-width: 320px; width: 100%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
              .company-header { font-weight: 800; font-size: 16px; color: #0f172a; margin-bottom: 2px; }
              .badge-sub { font-size: 11px; color: #2563eb; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
              .avatar-img { width: 90px; height: 90px; border-radius: 16px; object-fit: cover; margin: 0 auto 10px; display: block; border: 2px solid #e2e8f0; }
              .avatar-placeholder { width: 90px; height: 90px; border-radius: 16px; background: #2563eb; color: white; font-size: 32px; font-weight: bold; line-height: 90px; margin: 0 auto 10px; }
              .emp-name { font-size: 16px; font-weight: bold; color: #0f172a; margin: 0; }
              .emp-role { font-size: 13px; color: #2563eb; font-weight: 600; margin: 2px 0 0; }
              .emp-id { font-size: 12px; font-family: monospace; color: #64748b; margin: 2px 0 12px; }
              .details-table { width: 100%; background: #f1f5f9; border-radius: 12px; padding: 10px 12px; font-size: 11px; text-align: left; margin-bottom: 14px; box-sizing: border-box; }
              .details-row { display: flex; justify-content: space-between; padding: 3px 0; }
              .details-label { color: #64748b; }
              .details-val { font-weight: 600; color: #0f172a; }
              .qr-box { margin: 10px auto; display: flex; justify-content: center; }
              .card-footer { font-size: 9px; color: #94a3b8; margin-top: 10px; }
              @media print { body { background: transparent; padding: 0; } .id-card-wrapper { box-shadow: none; } }
            </style>
          </head>
          <body>
            <div class="id-card-wrapper">
              <div class="company-header">RUDRA INFRA WORLD</div>
              <div class="badge-sub">Official Corporate Staff ID</div>
              ${avatarUrl ? `<img src="${avatarUrl}" class="avatar-img" />` : `<div class="avatar-placeholder">${currentUser.name.charAt(0).toUpperCase()}</div>`}
              <div class="emp-name">${currentUser.name}</div>
              <div class="emp-role">${currentUser.designation || 'Staff Member'}</div>
              <div class="emp-id">${currentUser.registration_id || 'EMP-ID'}</div>
              <div class="details-table">
                <div class="details-row"><span class="details-label">Site / Branch:</span><span class="details-val">${currentUser.site_name || 'Headquarters'}</span></div>
                ${currentUser.date_of_birth ? `<div class="details-row"><span class="details-label">DOB:</span><span class="details-val">${currentUser.date_of_birth}</span></div>` : ''}
                ${currentUser.date_of_joining ? `<div class="details-row"><span class="details-label">DOJ:</span><span class="details-val">${currentUser.date_of_joining}</span></div>` : ''}
                <div class="details-row"><span class="details-label">Status:</span><span class="details-val" style="color:#16a34a;">Active & Verified</span></div>
              </div>
              <div class="qr-box">${printContent.querySelector('.qr-container')?.innerHTML || ''}</div>
              <div class="card-footer">Authorized Official Staff Identity Card • Rudra Infra World</div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between pb-24 px-4 pt-3 max-w-md mx-auto font-sans transition-colors">
      
      <div className="space-y-3.5">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t('profile')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Settings & Digital Credentials</p>
          </div>
          
          <button
            id="view-digital-id-card-btn"
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold shadow-xs hover:bg-blue-100 transition-all active:scale-95 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Digital ID Card</span>
          </button>
        </div>

        {/* Quick App Preferences Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            App Customization & Preferences
          </h4>
          
          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="toggle-dark-mode-btn"
              onClick={onToggleTheme}
              className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between transition-all hover:bg-slate-100 dark:hover:bg-slate-700 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {theme === 'dark' ? 'Dark Mode' : 'White Mode'}
                </span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Toggle</span>
            </button>

            <button
              id="toggle-language-btn"
              onClick={onToggleLang}
              className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between transition-all hover:bg-slate-100 dark:hover:bg-slate-700 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {lang === 'en' ? 'English' : 'हिन्दी'}
                </span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Switch</span>
            </button>
          </div>
        </div>

        {/* Profile Card Header with Upload & Face Crop */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <label 
                htmlFor="avatar-upload-file-input"
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white cursor-pointer shadow-md border-2 border-white dark:border-slate-900"
                title="Choose Photo to Crop"
              >
                <Camera className="w-3 h-3" />
              </label>
              <input 
                id="avatar-upload-file-input" 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarSelect} 
                className="hidden" 
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</h3>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{currentUser.designation || 'Staff Member'}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono text-slate-700 dark:text-slate-300">
                  {currentUser.registration_id || 'EMP-ID'}
                </span>
                <span>•</span>
                <span>{currentUser.site_name || 'Headquarters'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal & Employment Information</h4>
            {successMsg && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {successMsg}
              </span>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Employee ID (Fixed)
            </label>
            <input
              type="text"
              value={currentUser.registration_id || 'EMP-ID'}
              disabled
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 font-mono cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Official Email
            </label>
            <input
              id="profile-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@rudra.com"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Date of Birth (DOB)
              </label>
              <input
                id="profile-dob-input"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Date of Joining (DOJ)
              </label>
              <input
                id="profile-doj-input"
                type="date"
                value={dateOfJoining}
                onChange={(e) => setDateOfJoining(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Current Residential Address
            </label>
            <input
              id="profile-address-input"
              type="text"
              value={currentAddress}
              onChange={(e) => setCurrentAddress(e.target.value)}
              placeholder="House/Flat, Street, City, State"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Marital Status
              </label>
              <select
                id="profile-marital-select"
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Emergency Contact
              </label>
              <input
                id="profile-emergency-input"
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            id="save-profile-btn"
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            {saving ? (
              <span>Saving Changes...</span>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </form>

        {/* Security Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{lang === 'hi' ? 'खाता सुरक्षा और पासवर्ड' : 'Account Security & Password'}</span>
            </h4>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 font-semibold px-2 py-0.5 rounded-md">
              {lang === 'hi' ? 'सुरक्षित' : 'Protected'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="w-full py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 hover:border-amber-300 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>{lang === 'hi' ? '🔑 पासवर्ड बदलें' : '🔑 Change Account Password'}</span>
          </button>
        </div>

        {/* Device Lock Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Security & Hardware Lock
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Your StaffSync credentials are bound to your authorized physical phone device to prevent proxy attendance marking.
          </p>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-700 dark:text-slate-300">Device Lock Status:</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Authorized & Active</span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          id="profile-logout-btn"
          onClick={onLogout}
          className="w-full py-3 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-800/60 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('sign_out')}</span>
        </button>

      </div>

      {/* ================= HIGH-PRIORITY FACE CROP MODAL ================= */}
      {cropModalOpen && rawImageSrc && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-3 text-center">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
                <Crop className="w-4 h-4 text-blue-600" />
                <span>Crop Face for ID Card</span>
              </div>
              <button 
                type="button"
                onClick={() => { setCropModalOpen(false); setRawImageSrc(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Drag photo to position your face inside the circle:
            </p>

            {/* Circular Crop Box */}
            <div 
              className="relative w-52 h-52 mx-auto rounded-full overflow-hidden bg-slate-950 border-4 border-blue-600 shadow-inner cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                className="w-full h-full flex items-center justify-center pointer-events-none"
                style={{
                  transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                  transition: isDragging ? 'none' : 'transform 0.08s ease-out'
                }}
              >
                <img 
                  src={rawImageSrc} 
                  alt="Face Preview" 
                  className="max-w-none max-h-none w-52 h-52 object-contain pointer-events-none" 
                  draggable={false} 
                />
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span className="flex items-center gap-1"><ZoomOut className="w-3.5 h-3.5" /> Zoom</span>
                <span>{Math.round(zoomLevel * 100)}%</span>
              </div>
              <input 
                type="range" 
                min={0.8} 
                max={3} 
                step={0.05} 
                value={zoomLevel} 
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setCropModalOpen(false); setRawImageSrc(null); }}
                className="w-1/2 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyFaceCrop}
                className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Crop</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Corporate Real Estate Digital ID Card Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            id="printable-id-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-xs w-full shadow-2xl text-center relative font-sans"
          >
            <div className="flex items-center justify-center gap-2 mb-2.5">
              <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-left">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">Rudra Infra World</h3>
                <p className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">Corporate Staff ID</p>
              </div>
            </div>

            <div className="my-2.5">
              <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl overflow-hidden mx-auto border-2 border-slate-200 dark:border-slate-700 shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-2">{currentUser.name}</h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{currentUser.designation || 'Staff Member'}</p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">{currentUser.registration_id || 'EMP-ID'}</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 text-xs text-left space-y-1 mb-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Site / Branch:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.site_name || 'Headquarters'}</span>
              </div>
              {currentUser.date_of_birth && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Date of Birth:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{currentUser.date_of_birth}</span>
                </div>
              )}
              {currentUser.date_of_joining && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Joining Date:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{currentUser.date_of_joining}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Card Validity:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active & Verified</span>
              </div>
            </div>

            <div className="qr-container bg-white p-2.5 rounded-2xl w-fit mx-auto my-2 border border-slate-200 shadow-xs">
              <QRCodeSVG
                value={`STAFFSYNC:${currentUser.registration_id || currentUser.id}:${currentUser.name}:${currentUser.site_name || 'HQ'}`}
                size={120}
                level="H"
              />
            </div>

            <div className="flex gap-2 mt-3.5 print:hidden">
              <button
                type="button"
                id="print-id-card-btn"
                onClick={handlePrintCard}
                className="w-1/2 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Card</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Close Badge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          currentUser={currentUser}
          onClose={() => setShowPasswordModal(false)}
          onPasswordChanged={(updatedUser) => {
            onUpdateUser(updatedUser);
          }}
          lang={lang}
        />
      )}

      {/* Footer Signature */}
      <div className="text-center pt-5 pb-1">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
          Designed & Developed by <span className="text-slate-700 dark:text-slate-300 font-semibold">Abhishek Bhatt</span>
        </p>
      </div>

    </div>
  );
};
