import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Tourist, Alert, AlertType, CrisisResponse, GeoZone } from './types';
import { IconShieldAlert, IconMap, IconList, IconSignal, IconCopy, IconCheck, IconArrowUpDown, IconBellRing, IconBrainCircuit, IconUser, IconClock, IconPhone, IconHeartPulse, IconMapPin, IconUserCircle, IconUsers, IconShield, IconShieldX, IconShieldCheck, IconFileText, IconLayoutDashboard, IconSettings } from './components/icons';
import TouristDatabase from './components/TouristDatabase';
import L from 'leaflet';
import { GoogleGenAI, Type } from "@google/genai";

// --- INDIA-SPECIFIC MOCK DATA & HELPERS ---

const geoZones: GeoZone[] = [
  { id: 'zone-1', name: 'High-Altitude Avalanche Zone', risk: 'high', bounds: [ { lat: 31.05, lng: 78.85 }, { lat: 31.10, lng: 78.88 }, { lat: 31.07, lng: 78.95 }, { lat: 31.02, lng: 78.92 } ] },
  { id: 'zone-2', name: 'Restricted Nanda Devi Sanctuary', risk: 'medium', bounds: [ { lat: 30.40, lng: 79.80 }, { lat: 30.45, lng: 79.82 }, { lat: 30.43, lng: 79.88 }, { lat: 30.38, lng: 79.85 } ] }
];

const isPointInPolygon = (point: { lat: number, lng: number }, polygon: Array<{ lat: number, lng: number }>): boolean => {
    const { lat, lng } = point; let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat; const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    } return isInside;
};

// --- UI COMPONENTS ---

const Header: React.FC = () => (
  <header className="bg-gray-800 shadow-md p-4 flex items-center justify-between z-20 col-span-2">
    <div className="flex items-center gap-3"><IconShieldAlert className="w-8 h-8 text-cyan-400" /><h1 className="text-xl md:text-2xl font-bold text-white tracking-wider">TourSafe <span className="font-light">Authority Dashboard</span></h1></div>
    <div className="flex items-center gap-2 text-green-400"><IconSignal className="w-5 h-5" /><span className="text-sm font-semibold">REAL-TIME</span></div>
  </header>
);

const Toggle: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ label, enabled, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-gray-300">{label}</span>
    <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
        <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
        <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"></label>
    </div>
  </div>
);

const Sidebar: React.FC<{ activeView: string; onViewChange: (view: string) => void; showGeoZones: boolean; onShowGeoZonesChange: (show: boolean) => void; predictiveWarnings: boolean; onPredictiveWarningsChange: (predict: boolean) => void; }> = ({ activeView, onViewChange, showGeoZones, onShowGeoZonesChange, predictiveWarnings, onPredictiveWarningsChange }) => (
  <aside className="bg-gray-800 text-white flex flex-col p-3 space-y-6 border-r border-gray-700">
    <nav className="flex-grow">
      <h3 className="px-2 mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">Views</h3>
      <a onClick={() => onViewChange('dashboard')} className={`flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${activeView === 'dashboard' ? 'bg-cyan-500 text-white' : 'hover:bg-gray-700'}`}><IconLayoutDashboard className="w-5 h-5 mr-3" />Dashboard</a>
      <a onClick={() => onViewChange('database')} className={`flex items-center px-3 py-2 mt-1 text-sm font-medium rounded-md cursor-pointer ${activeView === 'database' ? 'bg-cyan-500 text-white' : 'hover:bg-gray-700'}`}><IconUsers className="w-5 h-5 mr-3" />Tourist Database</a>
    </nav>
    <div>
      <h3 className="px-2 mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">Settings</h3>
      <div className="space-y-3 px-2 py-3 bg-gray-700/50 rounded-lg">
        <Toggle label="Show Geo-Zones" enabled={showGeoZones} onChange={onShowGeoZonesChange} />
        <Toggle label="Predictive Warnings" enabled={predictiveWarnings} onChange={onPredictiveWarningsChange} />
      </div>
    </div>
  </aside>
);

const StatsBar: React.FC<{ tourists: Tourist[] }> = ({ tourists }) => {
  const stats = useMemo(() => ({ total: tourists.length, safe: tourists.filter(t => t.status === 'safe').length, warning: tourists.filter(t => t.status === 'warning').length, onAlert: tourists.filter(t => t.status === 'alert').length }), [tourists]);
  return (<div className="bg-gray-800 border-b border-gray-700 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
    {[ { icon: IconUsers, label: 'Total Tourists', value: stats.total, color: 'text-blue-400' }, { icon: IconShield, label: 'Status: Safe', value: stats.safe, color: 'text-green-400' }, { icon: IconShieldAlert, label: 'Status: Warning', value: stats.warning, color: 'text-yellow-400' }, { icon: IconShieldX, label: 'Active Alerts', value: stats.onAlert, color: 'text-red-400' } ].map(s => (
      <div key={s.label} className="bg-gray-700/50 p-2 rounded-lg">
        <div className="flex items-center justify-center gap-2">{React.createElement(s.icon, {className: `w-5 h-5 ${s.color}`})}<span className="text-xl font-bold text-white">{s.value}</span></div><p className="text-xs text-gray-400">{s.label}</p>
      </div>))}
  </div>);
};

const AlertsPanel: React.FC<{ alerts: Alert[]; tourists: Tourist[]; selectedAlertId: string | null; onAlertSelect: (alertId: string, lat?: number, lng?: number) => void; onViewProfile: (uid: string) => void; }> = ({ alerts, tourists, selectedAlertId, onAlertSelect, onViewProfile }) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof Alert; direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const touristMap = useMemo(() => tourists.reduce((acc, t) => { acc[t.uid] = t; return acc; }, {} as Record<string, Tourist>), [tourists]);
  const sortedAlerts = useMemo(() => [...alerts].sort((a, b) => (a.timestamp.seconds < b.timestamp.seconds ? -1 : 1) * (sortConfig.direction === 'asc' ? 1 : -1)), [alerts, sortConfig]);
  return (<div className="bg-gray-800 flex flex-col h-full"><div className="p-4 border-b border-gray-700 flex items-center gap-3"><IconList className="w-6 h-6 text-cyan-400" /><h2 className="text-lg font-bold text-white">Active Alerts ({alerts.length})</h2></div><div className="flex-grow overflow-y-auto"><table className="w-full text-sm text-left text-gray-300"><thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0 z-10"><tr><th scope="col" className="px-4 py-3">Type</th><th scope="col" className="px-4 py-3">Tourist ID</th><th scope="col" className="px-4 py-3 cursor-pointer" onClick={() => setSortConfig(p => ({...p, direction: p.direction === 'asc' ? 'desc' : 'asc'}))}><div className="flex items-center">Time <IconArrowUpDown className="w-3 h-3 ml-1" /></div></th><th scope="col" className="px-2 py-3">Profile</th></tr></thead><tbody>
    {sortedAlerts.map(alert => { const tourist = touristMap[alert.uid]; return ( <tr key={alert.id} className={`${{'SOS': 'bg-red-500/20 border-red-500', 'GeoFence': 'bg-yellow-500/20 border-yellow-500', 'Inactivity': 'bg-blue-500/20 border-blue-500'}[alert.type]} border-l-4 hover:bg-gray-600/50 cursor-pointer ${alert.id === selectedAlertId ? 'bg-cyan-900/50' : ''}`} onClick={() => onAlertSelect(alert.id, tourist?.location.lat, tourist?.location.lng)}>
    <td className="px-4 py-3 font-medium"><span className={`px-2 py-1 text-xs font-bold rounded-full ${{'SOS':'bg-red-500 text-white','GeoFence':'bg-yellow-500 text-black','Inactivity':'bg-blue-500 text-white'}[alert.type]}`}>{alert.type}</span></td>
    <td className="px-4 py-3 font-mono text-xs">{alert.uid.substring(0, 8)}...<button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(alert.uid); setCopiedUid(alert.uid); setTimeout(() => setCopiedUid(null), 2000); }} className="ml-2 text-gray-400 hover:text-white">{copiedUid === alert.uid ? <IconCheck className="w-3 h-3 text-green-400" /> : <IconCopy className="w-3 h-3" />}</button></td><td className="px-4 py-3">{new Date(alert.timestamp.seconds * 1000).toLocaleTimeString()}</td>
    <td className="px-2 py-3 text-center"><button onClick={e => { e.stopPropagation(); onViewProfile(alert.uid); }} className="text-gray-400 hover:text-cyan-400 p-1"><IconUser className="w-4 h-4" /></button></td></tr>);})}
    </tbody></table>{alerts.length === 0 && <div className="text-center py-10 text-gray-500"><IconBellRing className="mx-auto w-12 h-12" /><p className="mt-2">No active alerts.</p></div>}</div></div>);
};

const CrisisResponsePanel: React.FC<{ response: CrisisResponse | null, isLoading: boolean, tourist: Tourist | null }> = ({ response, isLoading, tourist }) => {
  const [isFirFiled, setIsFirFiled] = useState(false); useEffect(() => { setIsFirFiled(false); }, [response]);
  const renderContent = () => { if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Generating Response...</span></div>; if (response?.error) return <div className="flex flex-col items-center justify-center h-full text-red-400 p-4 text-center"><IconShieldAlert className="w-10 h-10 mb-2" /><h3 className="font-semibold">Error Generating Response</h3><p className="text-sm text-gray-400">{response.error}</p></div>; if (!response) return <div className="flex flex-col items-center justify-center h-full text-gray-500"><IconBrainCircuit className="w-12 h-12 mb-4" /><p>Select an alert to view AI-powered crisis response.</p></div>;
    const { anomaly_detection_status: anomaly, digital_id_retrieval: digitalId, contextual_guidance: guidance, multilingual_communication: comms } = response;
    return (<div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
      <div className="bg-gray-700/50 p-3 rounded-lg"><h4 className="font-bold text-red-400 mb-2">Anomaly Detection</h4><p><strong>Level:</strong> <span className="text-red-400 font-semibold">{anomaly.level}</span></p><p><strong>Cause:</strong> {anomaly.cause}</p><p><strong>Risk Score:</strong> {anomaly.risk_score}</p><p><strong>Action:</strong> {anomaly.action_required}</p><p><strong>Geo-Fence:</strong> {anomaly.geo_fencing_violation}</p></div>
      <div className="bg-gray-700/50 p-3 rounded-lg"><h4 className="font-bold text-blue-400 mb-2">Digital ID Retrieval</h4><p><strong>Status:</strong> {digitalId.status}</p><p><strong>Name:</strong> {digitalId.tourist_name}</p><p><strong>Emergency Contact:</strong> {digitalId.emergency_contact}</p><p><strong>Medical Data:</strong> <span className="text-yellow-400">{digitalId.critical_medical_data}</span></p><p className="font-mono text-xs"><strong>Doc Hash:</strong> {digitalId.document_hash}</p></div>
      <div className="bg-gray-700/50 p-3 rounded-lg col-span-1 lg:col-span-2"><h4 className="font-bold text-yellow-400 mb-2">Contextual Guidance</h4><p><strong>Target Team:</strong> {guidance.target_team}</p><p><strong>Priority:</strong> <span className="font-semibold">{guidance.mission_priority}</span></p><p><strong>Protocol:</strong> {guidance.critical_protocol}</p><p><strong>Note:</strong> {guidance.resource_note}</p></div>
      <div className="bg-gray-700/50 p-3 rounded-lg"><h4 className="font-bold text-green-400 mb-2">Message for Rescue ({comms.target_language})</h4><blockquote className="border-l-2 border-green-400 pl-2 text-gray-300 italic">{comms.message_for_rescue_team}</blockquote></div>
      <div className="bg-gray-700/50 p-3 rounded-lg"><h4 className="font-bold text-green-400 mb-2">Message for Contact ({comms.source_language})</h4><blockquote className="border-l-2 border-green-400 pl-2 text-gray-300 italic">{comms.message_for_contact}</blockquote></div>
      <div className="bg-gray-700/50 p-3 rounded-lg col-span-1 lg:col-span-2"><h4 className="font-bold text-cyan-400 mb-2">Automated Actions</h4><button onClick={() => setIsFirFiled(true)} disabled={isFirFiled} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">{isFirFiled ? (<><IconCheck className="w-4 h-4" /><span>e-FIR Filed for {tourist?.name}</span></>) : (<><IconFileText className="w-4 h-4" /><span>Initiate e-FIR</span></>)}</button></div>
    </div>);};
  return (<div className="flex-grow bg-gray-900 flex flex-col min-h-0"><div className="p-4 border-b border-gray-700 flex items-center gap-3"><IconBrainCircuit className="w-6 h-6 text-cyan-400" /><h2 className="text-lg font-bold text-white">AI Crisis Response</h2></div><div className="flex-grow overflow-y-auto">{renderContent()}</div></div>);
};

const TouristProfileModal: React.FC<{ tourist: Tourist; onClose: () => void }> = ({ tourist, onClose }) => (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconUserCircle className="w-8 h-8 text-cyan-400" />
          <div>
            <h2 className="text-xl font-bold text-white">{tourist.name} - Profile</h2>
            <div className="flex items-center gap-1.5 text-xs text-green-400 mt-1">
              <IconShieldCheck className="w-3 h-3" />
              <span>Blockchain Verified ID</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300">
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg text-white mb-2">Details</h3>
          <p><strong>UID:</strong> <span className="font-mono text-sm">{tourist.uid}</span></p>
          <p><strong>Age:</strong> {tourist.age}</p>
          <p><strong>Tech Comfort:</strong> <span className="capitalize">{tourist.techComfort}</span></p>
          <p><strong>Status:</strong> <span className={`font-bold ${{'alert':'text-red-400','warning':'text-yellow-400','safe':'text-green-400'}[tourist.status]}`}>{tourist.status.toUpperCase()}</span></p>
        </div>
        <div className="bg-gray-700/50 p-4 rounded-lg flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <IconPhone className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-lg text-white">Emergency Contact</h3>
          </div>
          <div className="flex-grow">
            <p><strong>Name:</strong> {tourist.emergencyContact.name}</p>
            <p><strong>Phone:</strong> {tourist.emergencyContact.phone}</p>
          </div>
          <a href={`tel:${tourist.emergencyContact.phone}`} className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-center flex items-center justify-center gap-2 transition-colors">
            <IconPhone className="w-4 h-4"/>
            Call Contact
          </a>
        </div>
        <div className="bg-gray-700/50 p-4 rounded-lg md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <IconHeartPulse className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-lg text-white">Critical Medical Notes</h3>
          </div>
          <p className="text-yellow-300">{tourist.medicalNotes || 'No critical medical notes on file.'}</p>
        </div>
        <div className="bg-gray-700/50 p-4 rounded-lg md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <IconMapPin className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-lg text-white">Recent Location History</h3>
          </div>
          <ul className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2">
            {[...tourist.locationHistory].reverse().map((loc, index) => (
              <li key={index} className="flex justify-between items-center bg-gray-900/50 p-2 rounded">
                <span className="font-mono text-xs">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                <span className="text-gray-400">{new Date(loc.timestamp.seconds * 1000).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
);

const LiveDashboard: React.FC<{
  tourists: Tourist[];
  mapContainerRef: React.RefObject<HTMLDivElement>;
  crisisResponse: CrisisResponse | null;
  isGeneratingResponse: boolean;
  selectedTouristForCrisis: Tourist | null;
  alerts: Alert[];
  selectedAlertId: string | null;
  onAlertSelect: (alertId: string, lat?: number, lng?: number) => void;
  onViewProfile: (uid: string) => void;
}> = ({ tourists, mapContainerRef, crisisResponse, isGeneratingResponse, selectedTouristForCrisis, alerts, selectedAlertId, onAlertSelect, onViewProfile }) => (
    <div className="flex flex-col h-full bg-gray-900">
      <StatsBar tourists={tourists} />
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 min-h-0">
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-700 flex items-center gap-3"><IconMap className="w-6 h-6 text-cyan-400" /><h2 className="text-lg font-bold text-white">Live Map: Himalayan Region</h2></div>
          <div ref={mapContainerRef} className="flex-grow w-full" />
        </div>
        <div className="lg:col-span-1 flex flex-col min-h-0 h-[50vh] lg:h-auto overflow-hidden">
            <div className='hidden lg:flex lg:flex-col lg:h-1/2 min-h-0'>
                <CrisisResponsePanel response={crisisResponse} isLoading={isGeneratingResponse} tourist={selectedTouristForCrisis} />
            </div>
            <div className='h-full lg:h-1/2 min-h-0'>
                <AlertsPanel alerts={alerts} tourists={tourists} selectedAlertId={selectedAlertId} onAlertSelect={onAlertSelect} onViewProfile={onViewProfile} />
            </div>
        </div>
      </main>
    </div>
);

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [tourists, setTourists] = useState<Tourist[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedTourist, setSelectedTourist] = useState<Tourist | null>(null);
  const [crisisResponse, setCrisisResponse] = useState<CrisisResponse | null>(null);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState<boolean>(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [showGeoZones, setShowGeoZones] = useState(true);
  const [predictiveWarnings, setPredictiveWarnings] = useState(true);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const geoZoneLayersRef = useRef<Record<string, L.Polygon>>({});
  
  const indianNames = ["Aarav Sharma", "Vivaan Singh", "Aditya Kumar", "Vihaan Gupta", "Arjun Patel", "Sai Joshi", "Reyansh Reddy", "Ayaan Verma", "Krishna Nair", "Ishaan Khan", "Saanvi Devi", "Aanya Mehta", "Aadhya Mishra", "Myra Agarwal", "Ananya Jain", "Pari Shah", "Diya Kumar", "Riya Singh", "Siya Patel", "Anika Gupta"];
  
  useEffect(() => {
    const initialTourists: Tourist[] = Array.from({ length: 20 }, (_, i) => { const now = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }; const initialLocation = { lat: 30.0869 + (Math.random() - 0.5) * 0.5, lng: 78.2676 + (Math.random() - 0.5) * 0.5 }; const nameParts = indianNames[i % indianNames.length].split(" "); return { uid: `tourist-id-${i}`, name: indianNames[i % indianNames.length], location: initialLocation, lastUpdated: now, status: 'safe', age: 20 + Math.floor(Math.random() * 40), techComfort: ['low', 'medium', 'high'][i % 3] as any, medicalNotes: Math.random() < 0.2 ? 'Allergy: Sulfa Drugs' : 'None', emergencyContact: { name: `Rohan ${nameParts[1]}`, phone: `+91 98765 432${String(i).padStart(2, '0')}` }, locationHistory: [{ ...initialLocation, timestamp: now }] }; });
    setTourists(initialTourists);

    const intervalId = setInterval(() => {
      setTourists(current => current.map(t => {
          const newLocation = { lat: t.location.lat + (Math.random() - 0.5) * 0.002, lng: t.location.lng + (Math.random() - 0.5) * 0.002 }; const now = { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }; let newStatus = t.status;
          if (newStatus !== 'alert' && predictiveWarnings) { const inHighRiskZone = geoZones.some(zone => zone.risk === 'high' && isPointInPolygon(newLocation, zone.bounds)); newStatus = inHighRiskZone ? 'warning' : 'safe'; } else if (newStatus !== 'alert' && !predictiveWarnings) { newStatus = 'safe'; }
          return { ...t, location: newLocation, lastUpdated: now, locationHistory: [...t.locationHistory, { ...newLocation, timestamp: now }].slice(-10), status: newStatus };
      }));
      if (Math.random() < 0.1) { setTourists(current => { const available = current.filter(t => t.status !== 'alert'); if (available.length === 0) return current; const randomT = available[Math.floor(Math.random() * available.length)]; const newAlert: Alert = { id: `alert-${Date.now()}`, uid: randomT.uid, type: ['SOS', 'GeoFence', 'Inactivity'][Math.floor(Math.random()*3)] as AlertType, timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }, details: 'Potential fall detected after 15 minutes of inactivity in a high-risk zone.' }; setAlerts(currentA => [newAlert, ...currentA].slice(0, 50)); return current.map(t => t.uid === randomT.uid ? { ...t, status: 'alert' } : t); }); }
    }, 3000); return () => clearInterval(intervalId);
  }, [predictiveWarnings]);

  useEffect(() => {
    if (!selectedAlertId) return;
    const alert = alerts.find(a => a.id === selectedAlertId); const tourist = tourists.find(t => t.uid === alert?.uid); if (!alert || !tourist) return;
    const generateCrisisResponse = async () => { setIsGeneratingResponse(true); setCrisisResponse(null); try { const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); const schema = { type: Type.OBJECT, properties: { anomaly_detection_status: { type: Type.OBJECT, properties: { level: { type: Type.STRING }, cause: { type: Type.STRING }, risk_score: { type: Type.STRING }, action_required: { type: Type.STRING }, geo_fencing_violation: { type: Type.STRING } } }, digital_id_retrieval: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, tourist_name: { type: Type.STRING }, emergency_contact: { type: Type.STRING }, critical_medical_data: { type: Type.STRING }, document_hash: { type: Type.STRING } } }, contextual_guidance: { type: Type.OBJECT, properties: { target_team: { type: Type.STRING }, mission_priority: { type: Type.STRING }, critical_protocol: { type: Type.STRING }, resource_note: { type: Type.STRING } } }, multilingual_communication: { type: Type.OBJECT, properties: { source_language: { type: Type.STRING }, target_language: { type: Type.STRING }, message_for_rescue_team: { type: Type.STRING }, message_for_contact: { type: Type.STRING } } } } };
      const prompt = `Simulate a Level 3 Crisis Alert based on the following input data: 1. User ID: ${tourist.uid} (${tourist.age}-year-old tourist, ${tourist.techComfort} tech comfort). 2. Location: ${tourist.location.lat.toFixed(4)}, ${tourist.location.lng.toFixed(4)} (Himalayan trekking zone, India). 3. Anomaly Data: Alert Type is '${alert.type}'. Details: ${alert.details}. 4. Tourist Medical Data: ${tourist.medicalNotes}. 5. Emergency Contact: ${tourist.emergencyContact.name} (${tourist.emergencyContact.phone}). 6. Required Target Language for Rescue Team: Hindi. 7. Primary Rescue Authority: NDRF / SDRF Uttarakhand. Generate the full crisis response analysis.`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction: "You are 'TourSafe Cognitive Core,' an AI Agent for safety analysis in India. Output MUST be a single, valid JSON object.", responseMimeType: "application/json", responseSchema: schema } }); setCrisisResponse(JSON.parse(response.text)); } catch (error) { console.error("Error generating crisis response:", error); setCrisisResponse({ error: "Failed to generate AI response. API error or overload." } as CrisisResponse); } finally { setIsGeneratingResponse(false); } };
    generateCrisisResponse();
  }, [selectedAlertId, alerts, tourists]);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, { center: [30.0869, 78.2676], zoom: 10 }); L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map); mapRef.current = map;
      geoZones.forEach(zone => { const color = zone.risk === 'high' ? '#ef4444' : '#f59e0b'; geoZoneLayersRef.current[zone.id] = L.polygon(zone.bounds as L.LatLngExpression[], { color: color, weight: 2, opacity: 0.6, fillOpacity: 0.1 }).bindTooltip(zone.name, { sticky: true, className: 'leaflet-tooltip' }); });
    }
    Object.values(geoZoneLayersRef.current).forEach(layer => { if (showGeoZones && mapRef.current && !mapRef.current.hasLayer(layer)) { layer.addTo(mapRef.current); } else if (!showGeoZones && mapRef.current && mapRef.current.hasLayer(layer)) { layer.removeFrom(mapRef.current); } });
  }, [showGeoZones]);

  useEffect(() => {
    if (!mapRef.current) return; const map = mapRef.current, currentMarkers = markersRef.current;
    const icons = { alert: L.divIcon({ className: 'leaflet-pulsing-icon', iconSize: [20, 20], iconAnchor: [10, 10] }), safe: L.divIcon({ className: 'leaflet-safe-icon', iconSize: [16, 16], iconAnchor: [8, 8] }), warning: L.divIcon({ className: 'leaflet-safe-icon', html: `<div style="background-color: #f59e0b; width: 100%; height: 100%; border-radius: 50%;"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) };
    tourists.forEach(t => { if (currentMarkers[t.uid]) { currentMarkers[t.uid].setLatLng([t.location.lat, t.location.lng]).setIcon(icons[t.status]).setTooltipContent(t.name); } else { currentMarkers[t.uid] = L.marker([t.location.lat, t.location.lng], { icon: icons[t.status] }).addTo(map).bindTooltip(t.name, { permanent: false, direction: 'top', offset: L.point(0, -10) }).on('click', () => setSelectedTourist(t)); } });
    Object.keys(currentMarkers).forEach(uid => { if (!tourists.find(t => t.uid === uid)) { currentMarkers[uid].remove(); delete currentMarkers[uid]; } });
  }, [tourists]);

  const handleAlertSelect = (alertId: string, lat?: number, lng?: number) => { setSelectedAlertId(alertId); if (lat && lng) mapRef.current?.flyTo([lat, lng], 13); };
  const handleViewProfile = (uid: string) => { const tourist = tourists.find(t => t.uid === uid); if (tourist) setSelectedTourist(tourist); };
  const handleCenterOnMap = (lat: number, lng: number) => { setActiveView('dashboard'); setTimeout(() => mapRef.current?.flyTo([lat, lng], 14), 100); };
  const selectedTouristForCrisis = useMemo(() => { if (!selectedAlertId) return null; const alert = alerts.find(a => a.id === selectedAlertId); return tourists.find(t => t.uid === alert?.uid) || null; }, [selectedAlertId, alerts, tourists]);

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-200 grid grid-cols-[auto_1fr] overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} showGeoZones={showGeoZones} onShowGeoZonesChange={setShowGeoZones} predictiveWarnings={predictiveWarnings} onPredictiveWarningsChange={setPredictiveWarnings} />
      <div className="flex flex-col overflow-hidden">
        <Header />
        <div className="flex-grow min-h-0">
          <div className={`h-full w-full ${activeView === 'dashboard' ? 'block' : 'hidden'}`}>
            <LiveDashboard
                tourists={tourists}
                mapContainerRef={mapContainerRef}
                crisisResponse={crisisResponse}
                isGeneratingResponse={isGeneratingResponse}
                selectedTouristForCrisis={selectedTouristForCrisis}
                alerts={alerts}
                selectedAlertId={selectedAlertId}
                onAlertSelect={handleAlertSelect}
                onViewProfile={handleViewProfile}
            />
          </div>
          <div className={`h-full w-full ${activeView === 'database' ? 'block' : 'hidden'}`}>
            <TouristDatabase tourists={tourists} onViewProfile={handleViewProfile} onCenterOnMap={handleCenterOnMap}/>
          </div>
        </div>
      </div>
      {selectedTourist && <TouristProfileModal tourist={selectedTourist} onClose={() => setSelectedTourist(null)} />}
    </div>
  );
};

export default App;
