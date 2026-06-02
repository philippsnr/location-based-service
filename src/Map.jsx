import { useCallback, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIconUrl from './assets/marker.png';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import LocateControl from './components/LocateControl';
import LocationInfoSheet from './components/LocationInfoSheet';
import { reverseGeocode } from './services/nominatim';

const defaultPosition = [54.4047, 10.2256];

const customMarkerIcon = new L.Icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

async function fetchLocationInfo(lat, lng) {
  const { placeName } = await reverseGeocode(lat, lng);

  const searchRes = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(placeName)}&format=json&origin=*`
  );
  const searchData = await searchRes.json();
  const firstResult = searchData?.query?.search?.[0];

  if (!firstResult) {
    return { placeName, wikiSummary: null, wikiUrl: null, wikiThumbnail: null };
  }

  const summaryRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`
  );
  const summaryData = await summaryRes.json();

  return {
    placeName,
    wikiSummary: summaryData.extract ?? null,
    wikiUrl: summaryData.content_urls?.desktop?.page ?? null,
    wikiThumbnail: summaryData.thumbnail?.source ?? null,
  };
}

function LocationMarker({ position, onSelect, placeName }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={customMarkerIcon}>
      <Popup>{placeName ?? 'Loading…'}</Popup>
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const handlePositionSelect = useCallback(async (latlng) => {
    const lat = latlng.lat ?? latlng[0];
    const lng = latlng.lng ?? latlng[1];
    setPosition(latlng);
    setSheetOpen(true);
    setInfoLoading(true);
    setLocationInfo(null);
    try {
      const info = await fetchLocationInfo(lat, lng);
      setLocationInfo(info);
    } catch (err) {
      console.warn('Failed to fetch location info:', err);
      setLocationInfo({ placeName: 'Unknown location', wikiSummary: null, wikiUrl: null, wikiThumbnail: null });
    } finally {
      setInfoLoading(false);
    }
  }, []);

  const handleLocate = useCallback((latlng) => handlePositionSelect(latlng), [handlePositionSelect]);

  useEffect(() => {
    // Request user's geolocation on component mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const userPosition = [latitude, longitude];
          setMapCenter(userPosition);
          handlePositionSelect(userPosition);
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
  }, [handlePositionSelect]);

  // Only render map when center position is determined
  if (!mapCenter) {
    return <div className="map-container">Loading your location...</div>;
  }

  return (
    <>
      <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={true} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomToLocation position={position} />
        <LocationMarker position={position} onSelect={handlePositionSelect} placeName={locationInfo?.placeName} />
        <LocateControl onLocate={handleLocate} />
      </MapContainer>
      <LocationInfoSheet
        opened={sheetOpen}
        onClosed={() => setSheetOpen(false)}
        locationInfo={locationInfo}
        loading={infoLoading}
      />
    </>
  );
}

export default Map;
