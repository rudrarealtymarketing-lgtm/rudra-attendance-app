import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Edit, Trash2, Smartphone, Shield, 
  Lock, Eye, EyeOff, X, Clock, Building2, Check, RefreshCw,
  Briefcase, Sparkles, Settings
} from 'lucide-react';
import { User, Site } from '../../types';
import { CORPORATE_DESIGNATIONS } from '../../constants';

interface DesignationItem {
  id: number;
  name: string;
  department?: string;
}

interface AdminStaffTabProps {
  users: User[];
  sites: Site[];
  onRefresh: () => void;
}

export const AdminStaffTab: React.FC<AdminStaffTabProps> = ({
  users,
  sites,
  onRefresh
}) => {
  // Only regular staff employees (exclude Super Admin & Director)
  const staffMembers = users.filter(u => {
    const r = (u.role || 'user').toLowerCase();
    return r !== 'super_admin' && r !== 'admin' && r !== 'director';
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Position / Designation master list
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [showPositionsModal, setShowPositionsModal] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');
  const [editingPositionId, setEditingPositionId] = useState<number | null>(null);
  const [editingPositionName, setEditingPositionName] = useState('');
  const [positionLoading, setPositionLoading] = useState(false);

  // Fetch designations from backend
  const fetchDesignations = async () => {
    try {
      const res = await fetch('/api/designations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDesignations(data);
        } else {
          // Default fallbacks from constants
          setDesignations(CORPORATE_DESIGNATIONS.map((d, i) => ({ id: i + 1, name: d })));
        }
      }
    } catch (e) {
      setDesignations(CORPORATE_DESIGNATIONS.map((d, i) => ({ id: i + 1, name: d })));
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, []);

  // Helper to generate a clean username from full name
  const generateUsernameFromName = (fullName: string) => {
    return fullName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .join('.');
  };

  // Add form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameAuto, setIsUsernameAuto] = useState(true);
  const [regId, setRegId] = useState(`EMP-${1000 + staffMembers.length + 1}`);
  const [password, setPassword] = useState('pass123');
  const [showPassword, setShowPassword] = useState(false);
  const [designation, setDesignation] = useState('');
  const [siteName, setSiteName] = useState(sites[0]?.name || 'Headquarters');
  const [allowedDevices, setAllowedDevices] = useState(1);
  const [workStartTime, setWorkStartTime] = useState('10:00');
  const [workEndTime, setWorkEndTime] = useState('19:00');
  const [submitting, setSubmitting] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRegId, setEditRegId] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editSiteName, setEditSiteName] = useState('');
  const [editAllowedDevices, setEditAllowedDevices] = useState(1);
  const [editStartTime, setEditStartTime] = useState('10:00');
  const [editEndTime, setEditEndTime] = useState('19:00');
  const [editPassword, setEditPassword] = useState('');

  // Handle Name Input Change (Auto-generate username)
  const handleNameChange = (val: string) => {
    setName(val);
    if (isUsernameAuto) {
      setUsername(generateUsernameFromName(val));
    }
  };

  const openAddModal = () => {
    const nextId = `EMP-${1000 + staffMembers.length + 1}`;
    setName('');
    setUsername('');
    setIsUsernameAuto(true);
    setRegId(nextId);
    setPassword('pass123');
    setDesignation(designations[0]?.name || CORPORATE_DESIGNATIONS[0] || 'Project Manager');
    setSiteName(sites[0]?.name || 'Headquarters');
    setAllowedDevices(1);
    setWorkStartTime('10:00');
    setWorkEndTime('19:00');
    setShowAddModal(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditUsername(u.username || generateUsernameFromName(u.name));
    setEditRegId(u.registration_id || '');
    setEditDesignation(u.designation || designations[0]?.name || CORPORATE_DESIGNATIONS[0]);
    setEditSiteName(u.site_name || sites[0]?.name || 'Headquarters');
    setEditAllowedDevices(u.allowed_devices || 1);
    setEditStartTime(u.work_start_time || '10:00');
    setEditEndTime(u.work_end_time || '19:00');
    setEditPassword('');
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !regId.trim() || !password.trim()) {
      alert('Please fill in Full Name, Employee ID, and Password');
      return;
    }

    const finalUsername = (username.trim() || generateUsernameFromName(name)).toLowerCase();

    setSubmitting(true);
    try {
      const res = await fetch('/api/super_admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          username: finalUsername,
          registration_id: regId.trim(),
          password: password.trim(),
          role: 'user',
          designation: designation || designations[0]?.name || 'Staff',
          site_name: siteName,
          allowed_devices: Number(allowedDevices) || 1,
          work_start_time: workStartTime,
          work_end_time: workEndTime
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Employee created successfully!');
        setShowAddModal(false);
        onRefresh();
      } else {
        alert(data.message || 'Failed to create employee');
      }
    } catch (err: any) {
      alert('Error creating staff: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        registration_id: editRegId.trim(),
        designation: editDesignation,
        site_name: editSiteName,
        allowed_devices: Number(editAllowedDevices),
        work_start_time: editStartTime,
        work_end_time: editEndTime
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Employee profile updated successfully!');
        setEditingUser(null);
        onRefresh();
      } else {
        alert(data.message || 'Failed to update employee');
      }
    } catch (err: any) {
      alert('Error updating staff: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Staff member removed successfully.');
        setDeleteConfirmUser(null);
        onRefresh();
      } else {
        alert(data.message || 'Failed to delete staff member');
      }
    } catch (err: any) {
      alert('Error deleting staff: ' + err.message);
    }
  };

  const handleResetDevice = async (userId: number) => {
    if (!confirm('Unlock hardware device binding for this employee?')) return;
    try {
      const res = await fetch(`/api/super_admin/users/${userId}/reset_device`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Hardware device lock reset successfully!');
        onRefresh();
      } else {
        alert(data.message || 'Failed to reset device');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Position CRUD handlers
  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPositionName.trim();
    if (!trimmed) return;
    setPositionLoading(true);
    try {
      const res = await fetch('/api/designations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewPositionName('');
        await fetchDesignations();
        setDesignation(trimmed);
      } else {
        alert(data.message || 'Failed to add position');
      }
    } catch (err: any) {
      alert('Error adding position: ' + err.message);
    } finally {
      setPositionLoading(false);
    }
  };

  const handleUpdatePosition = async (id: number) => {
    const trimmed = editingPositionName.trim();
    if (!trimmed) return;
    setPositionLoading(true);
    try {
      const res = await fetch(`/api/designations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingPositionId(null);
        setEditingPositionName('');
        await fetchDesignations();
        onRefresh();
      } else {
        alert(data.message || 'Failed to update position');
      }
    } catch (err: any) {
      alert('Error updating position: ' + err.message);
    } finally {
      setPositionLoading(false);
    }
  };

  const handleDeletePosition = async (id: number) => {
    if (!confirm('Are you sure you want to delete this position / designation?')) return;
    setPositionLoading(true);
    try {
      const res = await fetch(`/api/designations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDesignations();
      } else {
        alert(data.message || 'Failed to delete position');
      }
    } catch (err: any) {
      alert('Error deleting position: ' + err.message);
    } finally {
      setPositionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Staff Directory & Hardware Device Access ({staffMembers.length})</span>
          </h3>
          <p className="text-xs text-slate-500">
            Manage employees, custom usernames, post designations & individual shift timings
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPositionsModal(true)}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
            title="Manage Corporate Positions and Roles"
          >
            <Briefcase className="w-3.5 h-3.5 text-amber-600" />
            <span>Positions / Posts ({designations.length})</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {staffMembers.map(u => (
          <div 
            key={u.id} 
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    u.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{u.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono font-semibold flex items-center gap-1 flex-wrap">
                    <span>{u.registration_id}</span>
                    {u.username && (
                      <span className="text-slate-500 font-normal">(@{u.username})</span>
                    )}
                    <span>•</span>
                    <span className="text-amber-600 dark:text-amber-400 font-sans">{u.designation || 'Staff'}</span>
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-bold">
                {u.site_name || 'Headquarters'}
              </span>
            </div>

            {/* Shift & Device Parameters */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Work Shift Schedule:</span>
                </span>
                <strong className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {u.work_start_time || '10:00 AM'} → {u.work_end_time || '07:00 PM'}
                </strong>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Device Access Limit:</span>
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {u.allowed_devices || 1} Device{Number(u.allowed_devices) > 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>Hardware Binding:</span>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  u.device_fingerprint 
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}>
                  {u.device_fingerprint ? '🔒 Bound to Phone' : '🔓 Unlocked (Free)'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(u)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit Profile</span>
                </button>

                <button
                  onClick={() => handleResetDevice(u.id)}
                  className="px-2 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Unlock Device Binding"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset Device</span>
                </button>
              </div>

              <button
                onClick={() => setDeleteConfirmUser(u)}
                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                title="Delete Employee"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ================= ADD EMPLOYEE MODAL ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Add New Employee</h3>
                  <p className="text-[11px] text-slate-400">Unique Username & Employee ID are separate</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              {/* Full Name */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-medium"
                />
              </div>

              {/* Username & Employee ID (Decoupled) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 dark:text-slate-300 font-bold">Username *</label>
                    <span className="text-[10px] text-amber-600 font-semibold">(Auto from name)</span>
                  </div>
                  <input
                    required
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setIsUsernameAuto(false);
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                    }}
                    placeholder="ramesh.patel"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Employee ID *</label>
                  <input
                    required
                    type="text"
                    value={regId}
                    onChange={(e) => setRegId(e.target.value)}
                    placeholder="EMP-1001"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Login Password *</label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="pass123"
                    className="w-full p-2.5 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Position / Designation Dropdown & Site */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 dark:text-slate-300 font-bold">Position / Post *</label>
                    <button
                      type="button"
                      onClick={() => setShowPositionsModal(true)}
                      className="text-[10px] text-amber-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Edit Posts</span>
                    </button>
                  </div>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {designations.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Assigned Site *</label>
                  <select
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {sites.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Individual Shift In-Time & Out-Time */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 space-y-2">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Individual Work Schedule (In-Time & Out-Time)</span>
                </span>
                
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Shift In-Time (Start):</label>
                    <input
                      type="time"
                      required
                      value={workStartTime}
                      onChange={(e) => setWorkStartTime(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Shift Out-Time (End):</label>
                    <input
                      type="time"
                      required
                      value={workEndTime}
                      onChange={(e) => setWorkEndTime(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Device Access Limit */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  Device Access Limit (Allowed Hardware Phones):
                </label>
                <select
                  value={allowedDevices}
                  onChange={(e) => setAllowedDevices(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value={1}>1 Hardware Device (Default - High Security)</option>
                  <option value={2}>2 Hardware Devices</option>
                  <option value={3}>3 Hardware Devices</option>
                  <option value={5}>5 Hardware Devices</option>
                  <option value={99}>Unlimited Devices (No Hardware Lock)</option>
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creating Profile...' : 'Create Employee Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT EMPLOYEE MODAL ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Edit Employee Profile</h3>
                  <p className="text-[11px] text-slate-400">{editingUser.registration_id} • {editingUser.name}</p>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Username *</label>
                  <input
                    required
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Employee ID *</label>
                  <input
                    required
                    type="text"
                    value={editRegId}
                    onChange={(e) => setEditRegId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 dark:text-slate-300 font-bold">Position / Post *</label>
                    <button
                      type="button"
                      onClick={() => setShowPositionsModal(true)}
                      className="text-[10px] text-amber-600 font-bold hover:underline cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                  <select
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {designations.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Assigned Site</label>
                  <select
                    value={editSiteName}
                    onChange={(e) => setEditSiteName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {sites.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Individual Shift In-Time & Out-Time */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 space-y-2">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Update Work Shift Timings</span>
                </span>
                
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Shift In-Time (Start):</label>
                    <input
                      type="time"
                      required
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Shift Out-Time (End):</label>
                    <input
                      type="time"
                      required
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Device limit */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Device Access Limit:</label>
                <select
                  value={editAllowedDevices}
                  onChange={(e) => setEditAllowedDevices(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value={1}>1 Hardware Device (Default)</option>
                  <option value={2}>2 Hardware Devices</option>
                  <option value={3}>3 Hardware Devices</option>
                  <option value={5}>5 Hardware Devices</option>
                  <option value={99}>Unlimited Devices</option>
                </select>
              </div>

              {/* Reset Password (Optional) */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">New Password (Leave blank to keep unchanged):</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password if changing"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-1/3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Update Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= POSITION / DESIGNATION MANAGEMENT MODAL ================= */}
      {showPositionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-3.5 text-xs max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Manage Positions & Posts</h3>
                  <p className="text-[11px] text-slate-400">Add, Rename, or Delete company designations</p>
                </div>
              </div>
              <button onClick={() => setShowPositionsModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add New Position Field */}
            <form onSubmit={handleAddPosition} className="flex gap-2 shrink-0">
              <input
                type="text"
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
                placeholder="Enter new post name (e.g. Site Supervisor)"
                className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={positionLoading || !newPositionName.trim()}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>

            {/* Position List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {designations.map(pos => (
                <div key={pos.id} className="pt-2 flex items-center justify-between gap-2">
                  {editingPositionId === pos.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingPositionName}
                        onChange={(e) => setEditingPositionName(e.target.value)}
                        className="flex-1 p-1.5 bg-slate-50 dark:bg-slate-800 border border-amber-400 rounded-lg text-xs font-semibold text-slate-800 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdatePosition(pos.id)}
                        disabled={positionLoading || !editingPositionName.trim()}
                        className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                        title="Save Changes"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPositionId(null);
                          setEditingPositionName('');
                        }}
                        className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {pos.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingPositionId(pos.id);
                            setEditingPositionName(pos.name);
                          }}
                          className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                          title="Rename Position"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePosition(pos.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md cursor-pointer"
                          title="Delete Position"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-right shrink-0">
              <button
                type="button"
                onClick={() => setShowPositionsModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-3xl p-5 max-w-xs w-full shadow-2xl text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Employee?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.registration_id})? All attendance logs will be permanently deleted.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="w-1/2 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUser.id)}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
