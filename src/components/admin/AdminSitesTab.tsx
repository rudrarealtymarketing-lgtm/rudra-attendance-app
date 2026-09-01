import React, { useState } from 'react';
import { 
  MapPin, Plus, Edit, Trash2, Globe, Layers, 
  Building2, X, Clock, Navigation, Check 
} from 'lucide-react';
import { Site } from '../../types';
import { SiteGeofenceMap } from '../SiteGeofenceMap';

interface AdminSitesTabProps {
  sites: Site[];
  onRefresh: () => void;
}

export const AdminSitesTab: React.FC<AdminSitesTabProps> = ({
  sites,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deleteConfirmSite, setDeleteConfirmSite] = useState<Site | null>(null);

  // Form states for Add
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(19.04574);
  const [lng, setLng] = useState(73.08025);
  const [radius, setRadius] = useState(150);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Edit
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLat, setEditLat] = useState(19.04574);
  const [editLng, setEditLng] = useState(73.08025);
  const [editRadius, setEditRadius] = useState(150);

  const openEditModal = (s: Site) => {
    const activeRadius = s.radius !== undefined && s.radius !== null 
      ? Number(s.radius) 
      : (s.geofence_radius !== undefined && s.geofence_radius !== null ? Number(s.geofence_radius) : 150);

    setEditingSite(s);
    setEditName(s.name);
    setEditAddress(s.address || '');
    setEditLat(s.latitude || 19.04574);
    setEditLng(s.longitude || 73.08025);
    setEditRadius(activeRadius);
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter site name');

    setSubmitting(true);
    const finalRadius = Number(radius) > 0 ? Number(radius) : 150;
    try {
      const res = await fetch('/api/super_admin/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || 'Construction Site Location',
          latitude: Number(lat),
          longitude: Number(lng),
          radius: finalRadius,
          geofence_radius: finalRadius
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Construction site added successfully!');
        setShowAddModal(false);
        setName('');
        setAddress('');
        onRefresh();
      } else {
        alert(data.message || 'Failed to add site');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    setSubmitting(true);
    const finalRadius = Number(editRadius) > 0 ? Number(editRadius) : 150;
    try {
      const res = await fetch(`/api/super_admin/sites/${editingSite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSite.id,
          name: editName.trim(),
          address: editAddress.trim(),
          latitude: Number(editLat),
          longitude: Number(editLng),
          radius: finalRadius,
          geofence_radius: finalRadius
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Site geofence updated successfully!');
        setEditingSite(null);
        onRefresh();
      } else {
        alert(data.message || 'Failed to update site');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSite = async (id: number) => {
    try {
      const res = await fetch(`/api/super_admin/sites/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Site deleted successfully.');
        setDeleteConfirmSite(null);
        onRefresh();
      } else {
        alert(data.message || 'Failed to delete site');
      }
    } catch (err: any) {
      alert('Error deleting site: ' + err.message);
    }
  };

  const currentOverviewRadius = sites[0]?.radius !== undefined && sites[0]?.radius !== null 
    ? Number(sites[0].radius) 
    : (sites[0]?.geofence_radius !== undefined ? Number(sites[0].geofence_radius) : 150);

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-600" />
            <span>Construction Sites & Satellite Geofences ({sites.length})</span>
          </h3>
          <p className="text-xs text-slate-500">
            Define GPS coordinates and boundary meter radius with live satellite imagery
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Project Site</span>
        </button>
      </div>

      {/* Master Overview Map */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active Satellite Geofences Overview
          </span>
          <span className="text-xs font-semibold text-emerald-600">
            {sites.length} Configured Site Boundaries
          </span>
        </div>

        <SiteGeofenceMap
          sites={sites}
          latitude={sites[0]?.latitude || 19.04574}
          longitude={sites[0]?.longitude || 73.08025}
          radius={currentOverviewRadius}
          height="280px"
        />
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sites.map(site => {
          const siteDisplayRadius = site.radius !== undefined && site.radius !== null 
            ? Number(site.radius) 
            : (site.geofence_radius !== undefined && site.geofence_radius !== null ? Number(site.geofence_radius) : 150);

          return (
            <div 
              key={site.id} 
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs space-y-2.5 text-xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white text-sm block">{site.name}</span>
                  <p className="text-slate-500 text-[11px] mt-0.5">{site.address || 'Kharghar, Panvel'}</p>
                </div>
                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-[10px] font-bold">
                  {siteDisplayRadius}m Geofence
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                <p>GPS: {site.latitude?.toFixed(5) || '19.04574'}, {site.longitude?.toFixed(5) || '73.08025'}</p>
                <p>Radius: {siteDisplayRadius} meters</p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => openEditModal(site)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit Geofence</span>
                </button>

                <button
                  onClick={() => setDeleteConfirmSite(site)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Delete Site"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Add Construction Site</h3>
                  <p className="text-[11px] text-slate-400">Search location or place pin on Satellite Map</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="space-y-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  Search place or click/drag marker on Map:
                </label>
                <SiteGeofenceMap
                  sites={sites}
                  interactive={true}
                  latitude={lat}
                  longitude={lng}
                  radius={radius}
                  onLocationChange={(newLat, newLng, foundAddress) => {
                    setLat(newLat);
                    setLng(newLng);
                    if (foundAddress && !address) {
                      setAddress(foundAddress.split(',').slice(0, 3).join(','));
                    }
                  }}
                  height="220px"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Site Name *</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. ARAMUS RUDRA"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Address / Landmark</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Kharghar, Panvel"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Latitude:</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Longitude:</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Radius (Meters):</label>
                  <input
                    type="number"
                    required
                    min={20}
                    max={2000}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

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
                  {submitting ? 'Saving Site...' : 'Save Construction Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {editingSite && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-3.5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Edit Site Geofence</h3>
                  <p className="text-[11px] text-slate-400">{editingSite.name}</p>
                </div>
              </div>
              <button onClick={() => setEditingSite(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSite} className="space-y-3">
              <SiteGeofenceMap
                sites={sites}
                interactive={true}
                latitude={editLat}
                longitude={editLng}
                radius={editRadius}
                onLocationChange={(newLat, newLng, foundAddress) => {
                  setEditLat(newLat);
                  setEditLng(newLng);
                  if (foundAddress && !editAddress) {
                    setEditAddress(foundAddress.split(',').slice(0, 3).join(','));
                  }
                }}
                height="220px"
              />

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Site Name *</label>
                  <input
                    required
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs text-slate-800 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Latitude:</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editLat}
                    onChange={(e) => setEditLat(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Longitude:</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editLng}
                    onChange={(e) => setEditLng(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Radius (m):</label>
                  <input
                    type="number"
                    required
                    min={20}
                    max={2000}
                    value={editRadius}
                    onChange={(e) => setEditRadius(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSite(null)}
                  className="w-1/3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Update Geofence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Site Confirmation Modal */}
      {deleteConfirmSite && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-3xl p-5 max-w-xs w-full shadow-2xl text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Site?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to delete <strong>{deleteConfirmSite.name}</strong>?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmSite(null)}
                className="w-1/2 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSite(deleteConfirmSite.id)}
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
