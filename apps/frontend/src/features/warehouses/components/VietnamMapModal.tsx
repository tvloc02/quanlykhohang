import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Navigation, Check, X, Globe, Search, Layers, Compass } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VIETNAM_ALL_PROVINCES, type ProvinceData } from './vietnamData';

// Fix Leaflet marker default icon issue in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Red Cyan Pin Marker Icon for Leaflet
const customPinIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
      <div style="background-color: #0f172a; color: white; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15);">
        Ghim Vị Trí Kho
      </div>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="#e11d48" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.2));">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
        <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
      </svg>
    </div>
  `,
  iconSize: [34, 42],
  iconAnchor: [17, 42],
});

export const VIETNAM_PROVINCES = VIETNAM_ALL_PROVINCES;

interface VietnamMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (data: {
    province: string;
    ward: string;
    detailAddress: string;
    fullAddress: string;
    lat?: number;
    lng?: number;
  }) => void;
  initialProvince?: string;
  initialWard?: string;
  initialDetail?: string;
}

export default function VietnamMapModal({
  isOpen,
  onClose,
  onSelectAddress,
  initialProvince = '',
  initialWard = '',
  initialDetail = '',
}: VietnamMapModalProps) {
  const [selectedProvince, setSelectedProvince] = useState(initialProvince || VIETNAM_ALL_PROVINCES[0].name);
  const [selectedWard, setSelectedWard] = useState(initialWard || VIETNAM_ALL_PROVINCES[0].wards[0]);
  const [detailAddress, setDetailAddress] = useState(initialDetail);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 10.77653,
    lng: 106.70098,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapTileType, setMapTileType] = useState<'street' | 'satellite'>('street');

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const findProvinceData = (name: string) => {
    if (!name) return VIETNAM_ALL_PROVINCES[0];
    const cleanName = name.replace(/^(TP\.|Tỉnh|Thành phố)\s*/i, '').trim();
    return (
      VIETNAM_ALL_PROVINCES.find((p) => p.name === name) ||
      VIETNAM_ALL_PROVINCES.find((p) => p.name.includes(cleanName)) ||
      VIETNAM_ALL_PROVINCES[0]
    );
  };

  const currentProvinceData = findProvinceData(selectedProvince);

  // Reverse Geocoding: Look up province/ward/street when user clicks map or moves pin
  const reverseGeocodeLocation = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const pName = addr.city || addr.province || addr.state || addr.region || '';
        const wName =
          addr.suburb || addr.quarter || addr.town || addr.village || addr.city_district || addr.district || '';
        const road = addr.road || addr.pedestrian || addr.amenity || '';
        const houseNumber = addr.house_number ? `Số ${addr.house_number}, ` : '';
        const detail = (houseNumber + road).trim();

        if (pName) {
          const cleanP = pName.replace(/^(TP\.|Tỉnh|Thành phố)\s*/i, '').trim();
          const matchedP = VIETNAM_ALL_PROVINCES.find((p) => p.name.includes(cleanP) || cleanP.includes(p.name.replace(/^(TP\.|Tỉnh|Thành phố)\s*/i, '').trim()));
          if (matchedP) {
            setSelectedProvince(matchedP.name);

            if (wName) {
              const matchedW = matchedP.wards.find((w) => w.includes(wName) || wName.includes(w));
              if (matchedW) {
                setSelectedWard(matchedW);
              }
            }
          }
        }

        if (detail) {
          setDetailAddress(detail);
        }
      }
    } catch (err) {
      console.error('Lỗi tra cứu ngược địa chỉ:', err);
    }
  };

  // Sync coords when province dropdown changes manually
  useEffect(() => {
    const pData = findProvinceData(selectedProvince);
    if (pData && mapInstanceRef.current) {
      setCoords({ lat: pData.lat, lng: pData.lng });
      mapInstanceRef.current.setView([pData.lat, pData.lng], 13);
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([pData.lat, pData.lng]);
      }
    }
  }, [selectedProvince]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = currentProvinceData.lat;
      const initialLng = currentProvinceData.lng;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: false,
      });

      // Zoom control at top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add Tile Layer
      const streetTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const tileLayer = L.tileLayer(streetTileUrl, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Add Marker
      const marker = L.marker([initialLat, initialLng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);

      markerInstanceRef.current = marker;

      // Handle map click -> pin marker & auto-update address
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const newLat = Number(lat.toFixed(6));
        const newLng = Number(lng.toFixed(6));
        setCoords({ lat: newLat, lng: newLng });
        marker.setLatLng([lat, lng]);
        reverseGeocodeLocation(newLat, newLng);
      });

      // Handle marker drag -> pin marker & auto-update address
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        const newLat = Number(position.lat.toFixed(6));
        const newLng = Number(position.lng.toFixed(6));
        setCoords({ lat: newLat, lng: newLng });
        reverseGeocodeLocation(newLat, newLng);
      });

      mapInstanceRef.current = map;
    }

    // Resize map fix after portal render
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Clean up map instance when modal closes
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
      tileLayerRef.current = null;
    }
  }, [isOpen]);

  // Toggle Map Layer (Street vs Satellite)
  const toggleMapTile = (type: 'street' | 'satellite') => {
    setMapTileType(type);
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      type === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const attribution = type === 'satellite' ? '&copy; Esri World Imagery' : '&copy; OpenStreetMap';

    const newLayer = L.tileLayer(tileUrl, { maxZoom: 19, attribution }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  };

  // Search Address using OpenStreetMap Nominatim Geocoding API
  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery + ', Việt Nam',
        )}`,
      );
      const results = await response.json();

      if (results && results.length > 0) {
        const topResult = results[0];
        const newLat = parseFloat(topResult.lat);
        const newLng = parseFloat(topResult.lon);

        setCoords({ lat: Number(newLat.toFixed(6)), lng: Number(newLng.toFixed(6)) });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 15);
          if (markerInstanceRef.current) {
            markerInstanceRef.current.setLatLng([newLat, newLng]);
          }
        }

        reverseGeocodeLocation(newLat, newLng);
      }
    } catch (err) {
      console.error('Lỗi tìm kiếm địa chỉ:', err);
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    const full = [detailAddress, selectedWard, selectedProvince].filter(Boolean).join(', ');
    onSelectAddress({
      province: selectedProvince,
      ward: selectedWard,
      detailAddress,
      fullAddress: full,
      lat: coords.lat,
      lng: coords.lng,
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[95vw] lg:max-w-[1280px] h-[92vh] max-h-[92vh] overflow-hidden rounded-2xl border border-cyan-500 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-cyan-600 px-6 py-3 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2 text-white">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">
                Bản Đồ Địa Lý & 63 Tỉnh Thành Việt Nam
              </h3>
              <p className="text-xs text-cyan-100/90 font-normal">
                Bản đồ thực tế OpenStreetMap & Vệ tinh - Bấm hoặc ghim vị trí để tự động điền địa chỉ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 flex-1 min-h-0">
          {/* Left Form: Select Province & Address */}
          <div className="lg:col-span-4 p-5 space-y-4 bg-white flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              {/* Level 1: Province / City */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Tỉnh / Thành Phố <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-cyan-700">
                    Đủ 63 Tỉnh/Thành Việt Nam
                  </span>
                </div>
                <select
                  value={selectedProvince}
                  onChange={(e) => {
                    setSelectedProvince(e.target.value);
                    const pData = findProvinceData(e.target.value);
                    if (pData && pData.wards.length > 0) setSelectedWard(pData.wards[0]);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500"
                >
                  {VIETNAM_ALL_PROVINCES.map((p) => (
                    <option key={p.code + p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Level 2: Ward / District */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Phường / Xã <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-cyan-500"
                >
                  {currentProvinceData.wards.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line 3: Detailed Address */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Địa chỉ chi tiết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={detailAddress}
                  onChange={(e) => setDetailAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Khu công nghiệp..."
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs font-medium text-slate-900 outline-none transition focus:border-cyan-500"
                />
              </div>

              {/* GPS Coordinates Display */}
              <div className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-3 space-y-1">
                <p className="text-xs font-bold text-cyan-900 flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-cyan-600" /> Tọa độ GPS ghim trên bản đồ:
                </p>
                <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-700">
                  <span>Lat: {coords.lat}</span>
                  <span>Lng: {coords.lng}</span>
                </div>
              </div>
            </div>

            {/* Selected Address Preview */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1 mt-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Địa chỉ hoàn chỉnh:
              </span>
              <p className="text-xs font-semibold text-slate-900 leading-snug">
                {[detailAddress, selectedWard, selectedProvince].filter(Boolean).join(', ') ||
                  'Chưa nhập thông tin chi tiết'}
              </p>
            </div>
          </div>

          {/* Right Interactive Leaflet Real Map Viewport (MAXIMIZED) */}
          <div className="lg:col-span-8 p-4 bg-slate-50 flex flex-col justify-between space-y-3 h-full">
            {/* Map Header with Quick Search & Layer Switcher */}
            <div className="space-y-2 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Compass className="h-4 w-4 text-cyan-600" /> Bản đồ địa lý thực tế (Bấm chọn hoặc kéo ghim để tự động lấy địa chỉ)
                </span>

                {/* Map Layer Switcher */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => toggleMapTile('street')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                      mapTileType === 'street'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bản đồ đường
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMapTile('satellite')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                      mapTileType === 'satellite'
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vệ tinh
                  </button>
                </div>
              </div>

              {/* Geocoding Search Bar */}
              <form onSubmit={handleSearchLocation} className="relative flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tra cứu nhanh bất kỳ vị trí (VD: KCN Tân Bình, Cảng Cát Lái...)"
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-20 text-xs font-medium text-slate-900 outline-none transition focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-cyan-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-cyan-700 transition disabled:opacity-60 cursor-pointer"
                >
                  {isSearching ? 'Tìm...' : 'Tìm kiếm'}
                </button>
              </form>
            </div>

            {/* Leaflet Map Canvas Container (MAXIMIZED HEIGHT & WIDTH) */}
            <div className="relative flex-1 w-full min-h-[440px] overflow-hidden rounded-xl border border-slate-300 shadow-sm z-0">
              <div ref={mapContainerRef} className="h-full w-full" />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500 bg-cyan-600 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition cursor-pointer active:scale-95"
          >
            <Check className="h-4 w-4" />
            Xác Nhận Vị Trí
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
