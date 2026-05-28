import { useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import LocateControl from './components/LocateControl';

const initialPosition = [54.4047, 10.2256];

function LocationMarker({ position, onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>
        Name of the place <br /> LABOE!!!!!
      </Popup>
    </Marker>
  );
}

function Map() {
  const [position, setPosition] = useState(null);
  const handleLocate = useCallback((latlng) => setPosition(latlng), []);

  return (
    <MapContainer center={initialPosition} zoom={15} scrollWheelZoom={true} className="map-container">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker position={position} onSelect={setPosition} />
      <LocateControl onLocate={handleLocate} />
    </MapContainer>
  );
}

export default Map;
