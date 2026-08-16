import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const severityColor = (severity) => {
  if (severity >= 4) return '#e02424';
  if (severity >= 3) return '#f59e0b';
  return '#1a56db';
};

function LocationPicker({ onLocationSelect, position }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

export default function IssueMap({ issues = [], center = [28.6139, 77.2090], zoom = 12, onLocationSelect, pickerMode = false, className = '' }) {
  return (
    <div className={`map-container ${className}`}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pickerMode && onLocationSelect && (
          <LocationPicker onLocationSelect={onLocationSelect} position={center[0] ? { lat: center[0], lng: center[1] } : null} />
        )}
        {!pickerMode && issues.map(issue => {
          const [lng, lat] = issue.location?.coordinates || [];
          if (!lat || !lng) return null;
          const severity = issue.severity?.computed || 3;
          return (
            <Marker
              key={issue._id}
              position={[lat, lng]}
              icon={L.divIcon({
                className: 'custom-marker',
                html: `<div style="background:${severityColor(severity)};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })}
            >
              <Popup>
                <strong>{issue.title}</strong><br />
                {issue.category} - {issue.status}<br />
                Severity: {severity}/5
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
