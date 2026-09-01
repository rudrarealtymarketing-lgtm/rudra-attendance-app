import React, { useEffect, useRef, useState } from 'react';
import { Layers, Globe, MapPin, Locate, Search, X, Loader2 } from 'lucide-react';
import { Site } from '../types';

interface SiteGeofenceMapProps {
  sites: Site[];
  selectedSite?: Site | null;
  interactive?: boolean;
  latitude: number;
  longitude: number;
  radius: number;
  onLocationChange?: (lat: number, lng: number, address?: string) => void;
  onRadiusChange?: (radius: number) => void;
  height?: string;
  showSearch?: boolean;
}

declare global {
  interface Window {
    L: any;
  }
}

export const SiteGeofenceMap: React.FC<SiteGeofenceMapProps> = ({
  sites,
  selectedSite,
  interactive = false,
  latitude,
  longitude,
  radius,
  onLocationChange,
  onRadiusChange,
  height = '320px',
  showSearch = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const siteLayersRef = useRef<any[]>([]);

  const [mapType, setMapType] = useState<'satellite' | 'streets'>('satellite');
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCurrentLat(latitude);
    setCurrentLng(longitude);
  }, [latitude, longitude]);

  // Place Search Handler with graceful fallback
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(`/api/maps/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setSearchResults(data);
            setShowDropdown(true);
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      } finally {
        setIsSearching(false);
      }

      // Client-side fallback to match existing sites in memory
      const queryLower = trimmed.toLowerCase();
      const localMatches = sites
        .filter(s => s.name.toLowerCase().includes(queryLower) || (s.address && s.address.toLowerCase().includes(queryLower)))
        .map(s => ({
          lat: String(s.latitude || 19.04574),
          lon: String(s.longitude || 73.08025),
          display_name: `${s.name} (${s.address || 'Construction Site'})`
        }));

      if (localMatches.length > 0) {
        setSearchResults(localMatches);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
      }
    }, 300);
  };

  const handleSelectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const displayName = item.display_name;

    setCurrentLat(lat);
    setCurrentLng(lng);
    setSearchQuery(displayName.split(',')[0]);
    setShowDropdown(false);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 17);
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
    }

    if (onLocationChange) {
      onLocationChange(lat, lng, displayName);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = window.L;
    if (!L) return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultLat = currentLat || (sites[0]?.latitude) || 19.04574;
    const defaultLng = currentLng || (sites[0]?.longitude) || 73.08025;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: true
    });

    mapInstanceRef.current = map;

    // Tile layers
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
      }
    );

    const streetsLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }
    );

    if (mapType === 'satellite') {
      satelliteLayer.addTo(map);
    } else {
      streetsLayer.addTo(map);
    }

    // Clean previous layers
    siteLayersRef.current.forEach(layer => layer.remove());
    siteLayersRef.current = [];

    // Add existing sites if viewing master overview
    if (!interactive && sites.length > 0) {
      sites.forEach(s => {
        if (s.latitude && s.longitude) {
          const siteRadius = Number(s.radius) > 0 ? Number(s.radius) : 150;
          const m = L.marker([s.latitude, s.longitude]).addTo(map);
          m.bindPopup(`<b>${s.name}</b><br/>${s.address || ''}<br/>Radius: ${siteRadius}m`);
          const c = L.circle([s.latitude, s.longitude], {
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.2,
            radius: siteRadius
          }).addTo(map);
          siteLayersRef.current.push(m, c);
        }
      });
    }

    // Interactive target marker & geofence circle
    if (interactive) {
      const activeRadius = Number(radius) > 0 ? Number(radius) : 150;
      const marker = L.marker([defaultLat, defaultLng], {
        draggable: true
      }).addTo(map);

      const circle = L.circle([defaultLat, defaultLng], {
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.25,
        radius: activeRadius
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        setCurrentLat(pos.lat);
        setCurrentLng(pos.lng);
        if (onLocationChange) {
          onLocationChange(pos.lat, pos.lng);
        }
      });

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        setCurrentLat(lat);
        setCurrentLng(lng);
        if (onLocationChange) {
          onLocationChange(lat, lng);
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapType, sites, interactive]);

  // Update marker and circle position & dynamic radius in real-time
  useEffect(() => {
    if (mapInstanceRef.current && interactive) {
      const activeRadius = Number(radius) > 0 ? Number(radius) : 150;
      if (markerRef.current) {
        markerRef.current.setLatLng([currentLat, currentLng]);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([currentLat, currentLng]);
        circleRef.current.setRadius(activeRadius);
      }
      mapInstanceRef.current.panTo([currentLat, currentLng]);
    }
  }, [currentLat, currentLng, radius, interactive]);

  // Geolocation button
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentLat(lat);
          setCurrentLng(lng);
          if (onLocationChange) onLocationChange(lat, lng);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 17);
          }
        },
        (error) => {
          alert('Could not retrieve GPS coordinates: ' + error.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const displayRadius = Number(radius) > 0 ? Number(radius) : (sites[0]?.radius ? Number(sites[0].radius) : 150);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner bg-slate-900">
      
      {/* Map Tile Container */}
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

      {/* Search Input Bar (Interactive Mode Only) */}
      {interactive && showSearch && (
        <div className="absolute top-2.5 left-2.5 right-40 z-[1000]">
          <div className="relative">
            <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl px-2.5 py-1.5 shadow-lg text-white">
              <Search className="w-3.5 h-3.5 text-amber-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                placeholder="Search site, landmark or address..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
              />
              {isSearching && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mr-1" />}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowDropdown(false);
                  }}
                  className="p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Autocomplete Search Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto text-xs z-[1010]">
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSearchResult(item)}
                    className="p-2.5 hover:bg-amber-600/30 border-b border-slate-800 last:border-0 cursor-pointer text-slate-200 hover:text-white transition-colors flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{item.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Controls Bar: Satellite / Street Map / GPS Locate */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-lg text-xs text-white">
        <button
          type="button"
          onClick={() => setMapType('satellite')}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
            mapType === 'satellite' ? 'bg-amber-500 text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white'
          }`}
          title="Satellite Imagery"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>

        <button
          type="button"
          onClick={() => setMapType('streets')}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
            mapType === 'streets' ? 'bg-amber-500 text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white'
          }`}
          title="Street Map"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Street</span>
        </button>

        {interactive && (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            title="Use current GPS position"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Locate className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Coordinate & Radius HUD */}
      {interactive && (
        <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white text-[11px] font-mono flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Lat: {currentLat.toFixed(5)} | Lng: {currentLng.toFixed(5)} | Radius: {displayRadius}m</span>
        </div>
      )}
    </div>
  );
};
