

export interface Location {
  lat: number;
  lng: number;
}

export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface Tourist {
  uid: string;
  name: string;
  location: Location;
  lastUpdated: FirebaseTimestamp;
  status: 'safe' | 'alert' | 'warning';
  age: number;
  techComfort: 'low' | 'medium' | 'high';
  medicalNotes: string;
  emergencyContact: {
    name: string;
    phone: string;
  };
  locationHistory: Array<{
    lat: number;
    lng: number;
    timestamp: FirebaseTimestamp;
  }>;
}

export type AlertType = 'SOS' | 'GeoFence' | 'Inactivity';

export interface Alert {
  id: string;
  uid: string;
  type: AlertType;
  timestamp: FirebaseTimestamp;
  details: string;
}

export interface GeoZone {
  id: string;
  name: string;
  risk: 'high' | 'medium';
  bounds: Array<{ lat: number; lng: number; }>;
}


// New types for Crisis Response
export interface AnomalyDetectionStatus {
  level: string;
  cause: string;
  risk_score: string;
  action_required: string;
  geo_fencing_violation: string;
}

export interface DigitalIdRetrieval {
  status: string;
  tourist_name: string;
  emergency_contact: string;
  critical_medical_data: string;
  document_hash: string;
}

export interface ContextualGuidance {
  target_team: string;
  mission_priority: string;
  critical_protocol: string;
  resource_note: string;
}

export interface MultilingualCommunication {
  source_language: string;
  target_language: string;
  message_for_rescue_team: string;
  message_for_contact: string;
}

export interface CrisisResponse {
  anomaly_detection_status: AnomalyDetectionStatus;
  digital_id_retrieval: DigitalIdRetrieval;
  contextual_guidance: ContextualGuidance;
  multilingual_communication: MultilingualCommunication;
  error?: string;
}