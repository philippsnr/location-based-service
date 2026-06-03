import { useCallback, useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIconUrl from './assets/marker.png';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import LocateControl from './components/LocateControl';
import LocationInfoSheet from './components/LocationInfoSheet';
import RoutingMachine from './components/RoutingMachine';
import { reverseGeocode } from './services/nominatim';

const defaultPosition = [54.4047, 10.2256];

// Normalize {lat,lng} objects, [lat,lng] arrays, and L.LatLng instances to L.LatLng.
function toLatLng(v) {
  if (!v) return null;
  if (v instanceof L.LatLng) return v;
  if (Array.isArray(v)) return L.latLng(v[0], v[1]);
  if (typeof v.lat === 'number' && typeof v.lng === 'number') return L.latLng(v.lat, v.lng);
  return null;
}

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
    return { placeName, wikiSummary: null, wikiUrl: null };
  }

  const summaryRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`
  );
  const summaryData = await summaryRes.json();

  return {
    placeName,
    wikiSummary: summaryData.extract ?? null,
    wikiUrl: summaryData.content_urls?.desktop?.page ?? null,
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
  const [userPosition, setUserPosition] = useState(null);
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
      setLocationInfo({ placeName: 'Unknown location', wikiSummary: null, wikiUrl: null });
    } finally {
      setInfoLoading(false);
    }
  }, []);

  const handleLocate = useCallback((latlng) => {
    // Refresh the route origin only; do not change the selected target or open the info sheet.
    const ll = toLatLng(latlng);
    if (ll) setUserPosition(ll);
  }, []);

  useEffect(() => {
    // Request user's geolocation on component mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMapCenter([latitude, longitude]);
          setUserPosition(L.latLng(latitude, longitude));
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

  // Compute routing waypoints. Memoized so the RoutingMachine effect doesn't tear down
  // and rebuild the OSRM control on unrelated re-renders.
  const waypoints = useMemo(() => {
    const start = toLatLng(userPosition);
    const end = toLatLng(position);
    if (!start || !end) return null;
    if (start.equals(end)) return null;
    return [start, end];
  }, [userPosition, position]);

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
        {waypoints && <RoutingMachine waypoints={waypoints} />}
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
