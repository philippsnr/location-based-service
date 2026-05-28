import { useCallback, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIconUrl from './assets/marker.png';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import LocateControl from './components/LocateControl';

const defaultPosition = [54.4047, 10.2256];

const customMarkerIcon = new L.Icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function LocationMarker({ position, onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={customMarkerIcon}>
      <Popup>
        Name of the place <br /> LABOE!!!!!
      </Popup>
    </Marker>
  );
}

function ZoomToLocation({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 18, {
        duration: 2,
      });
    }
  }, [position, map]);

  return null;
}

function Map() {
  const [position, setPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const handleLocate = useCallback((latlng) => setPosition(latlng), []);

  useEffect(() => {
    // Request user's geolocation on component mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userPosition = [latitude, longitude];
          setMapCenter(userPosition);
          setPosition(userPosition);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          // Fall back to default position if geolocation fails
          setMapCenter(defaultPosition);
        }
      );
    } else {
      console.warn('Geolocation is not supported by this browser');
      setMapCenter(defaultPosition);
    }
  }, []);

  // Only render map when center position is determined
  if (!mapCenter) {
    return <div className="map-container">Loading your location...</div>;
  }

  return (
    <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={true} className="map-container">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomToLocation position={position} />
      <LocationMarker position={position} onSelect={setPosition} />
      <LocateControl onLocate={handleLocate} />
    </MapContainer>
  );
}

export default Map;
