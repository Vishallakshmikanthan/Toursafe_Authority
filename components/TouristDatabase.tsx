import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Tourist } from '../types';
import { IconSearch, IconArrowUpDown, IconUser, IconLocateFixed } from './icons';
import L from 'leaflet';

interface SortConfig {
  key: keyof Tourist;
  direction: 'asc' | 'desc';
}

interface TouristDatabaseProps {
  tourists: Tourist[];
  onViewProfile: (uid: string) => void;
  onCenterOnMap: (lat: number, lng: number) => void;
}

const TouristDatabase: React.FC<TouristDatabaseProps> = ({ tourists, onViewProfile, onCenterOnMap }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'name', direction: 'asc' });
  const [hoveredTourist, setHoveredTourist] = useState<Tourist | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [30.0869, 78.2676],
        zoom: 9,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
      mapRef.current = map;
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (hoveredTourist) {
      const { lat, lng } = hoveredTourist.location;
      map.flyTo([lat, lng], 13);
      
      const icon = L.divIcon({
        className: 'leaflet-pulsing-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
        .bindTooltip(hoveredTourist.name, { permanent: true, direction: 'top', offset: L.point(0, -10) });
    }
  }, [hoveredTourist]);

  const filteredTourists = useMemo(() => {
    return tourists.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.uid.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tourists, searchTerm]);

  const sortedTourists = useMemo(() => {
    if (!sortConfig) return filteredTourists;
    return [...filteredTourists].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      
      if (valA < valB) return -1 * direction;
      if (valA > valB) return 1 * direction;
      return 0;
    });
  }, [filteredTourists, sortConfig]);

  const handleSort = (key: keyof Tourist) => {
    setSortConfig(prev => {
      const isAsc = prev?.key === key && prev?.direction === 'asc';
      return { key, direction: isAsc ? 'desc' : 'asc' };
    });
  };

  const getStatusPillClass = (status: 'safe' | 'warning' | 'alert') => {
    switch (status) {
      case 'alert': return 'text-red-400 border-red-500 bg-red-500/10';
      case 'warning': return 'text-yellow-400 border-yellow-500 bg-yellow-500/10';
      default: return 'text-green-400 border-green-500 bg-green-500/10';
    }
  };

  const getRowClass = (status: 'safe' | 'warning' | 'alert') => {
    const baseClasses = "border-b transition-colors duration-150";
    switch (status) {
      case 'alert':
        return `${baseClasses} bg-red-900/50 border-red-700/50 hover:bg-red-900/70`;
      case 'warning':
        return `${baseClasses} bg-yellow-900/50 border-yellow-700/50 hover:bg-yellow-900/70`;
      default:
        return `${baseClasses} bg-gray-900 border-gray-700 hover:bg-gray-800/50`;
    }
  };

  return (
    <div className="bg-gray-900 grid grid-cols-1 md:grid-cols-3 h-full overflow-hidden text-white">
      <div className="md:col-span-2 flex flex-col h-full">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold mb-4">Tourist Database</h2>
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-md pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        <div className="flex-grow overflow-y-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Name <IconArrowUpDown className="w-3 h-3 ml-1.5" /></div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => handleSort('age')}>
                  <div className="flex items-center">Age <IconArrowUpDown className="w-3 h-3 ml-1.5" /></div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status <IconArrowUpDown className="w-3 h-3 ml-1.5" /></div>
                </th>
                <th scope="col" className="px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTourists.map(tourist => (
                <tr
                  key={tourist.uid}
                  className={getRowClass(tourist.status)}
                  onMouseEnter={() => setHoveredTourist(tourist)}
                  onMouseLeave={() => setHoveredTourist(null)}
                >
                  <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                    <div>{tourist.name}</div>
                    <div className="font-mono text-xs text-gray-400">{tourist.uid}</div>
                  </td>
                  <td className="px-6 py-4">{tourist.age}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusPillClass(tourist.status)}`}>
                      {tourist.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => onViewProfile(tourist.uid)} className="p-2 text-gray-400 hover:text-cyan-400 rounded-full hover:bg-gray-700" aria-label={`View profile for ${tourist.name}`}>
                      <IconUser className="w-4 h-4" />
                    </button>
                    <button onClick={() => onCenterOnMap(tourist.location.lat, tourist.location.lng)} className="p-2 text-gray-400 hover:text-green-400 rounded-full hover:bg-gray-700" aria-label={`Center map on ${tourist.name}`}>
                      <IconLocateFixed className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedTourists.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <IconSearch className="mx-auto w-12 h-12" />
              <p className="mt-2">No tourists found.</p>
            </div>
          )}
        </div>
      </div>
      <div className="hidden md:flex flex-col h-full border-l border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white">Location Preview</h3>
          <p className="text-xs text-gray-400">Hover over a tourist to see their location.</p>
        </div>
        <div ref={mapContainerRef} className="flex-grow w-full h-full" />
      </div>
    </div>
  );
};

export default TouristDatabase;