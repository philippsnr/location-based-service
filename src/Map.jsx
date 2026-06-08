import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIconUrl from './assets/marker.png';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import LocateControl from './components/LocateControl';
import MapStyleControl from './components/MapStyleControl';
import LocationInfoSheet from './components/LocationInfoSheet';
import RoutePlanningSheet from './components/RoutePlanningSheet';
import RoutingMachine from './components/RoutingMachine';
import SearchControl from './components/SearchControl';
import { reverseGeocode } from './services/nominatim';
import wikipedia from './services/wikipedia'
import { fetchWeather } from './services/weather'

const defaultPosition = [54.4047, 10.2256];
const MAP_STYLE_STORAGE_KEY = 'map-style';

const MAP_STYLES = {
  standard: {
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
};

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

//Updated: now uses wikipedia.js service
async function fetchLocationInfo(lat, lng) {
  const { placeName } = await reverseGeocode(lat, lng);

  const wiki = await wikipedia.getLocationSummary(placeName);

  return {
    placeName,
    lat,
    lng,
    wikiSummary: wiki?.summary ?? null,
    wikiUrl: wiki?.url ?? null,
    wikiThumbnail: wiki?.thumbnail ?? null,
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
  const [mapStyle, setMapStyle] = useState('standard');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [routingActive, setRoutingActive] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePlanningOpen, setRoutePlanningOpen] = useState(false);
  const [routePlanningKey, setRoutePlanningKey] = useState(0);
  const [confirmedRoute, setConfirmedRoute] = useState(null);
  // Prevents onClosed of LocationInfoSheet from clearing position when the
  // close was triggered by opening the route planning sheet.
  const openingRoutePlanningRef = useRef(false);

  useEffect(() => {
    try {
      const storedStyle = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
      if (storedStyle && Object.hasOwn(MAP_STYLES, storedStyle)) {
        setMapStyle(storedStyle);
      }
    } catch (error) {
      console.warn('Failed to read map style from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyle);
    } catch (error) {
      console.warn('Failed to save map style to localStorage:', error);
    }
  }, [mapStyle]);

  const handlePositionSelect = useCallback(async (latlng) => {
    const lat = latlng.lat ?? latlng[0];
    const lng = latlng.lng ?? latlng[1];
    setPosition(latlng);
    setSheetOpen(true);
    setInfoLoading(true);
    setLocationInfo(null);
    setRoutingActive(false);
    setRouteInfo(null);
    setConfirmedRoute(null);
    setRoutePlanningOpen(false);
    try {
      const [infoResult, weatherResult] = await Promise.allSettled([
        fetchLocationInfo(lat, lng),
        fetchWeather(lat, lng),
      ]);
      const info = infoResult.status === 'fulfilled'
        ? infoResult.value
        : { placeName: 'Unknown location', lat, lng, wikiSummary: null, wikiUrl: null, wikiThumbnail: null };
      const weatherInfo = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      setLocationInfo({ ...info, weatherInfo });
    } catch (err) {
      console.warn('Failed to fetch location info:', err);
      setLocationInfo({ placeName: 'Unknown location', lat, lng, wikiSummary: null, wikiUrl: null, wikiThumbnail: null, weatherInfo: null });
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

  const handleShowRoute = useCallback(() => {
    openingRoutePlanningRef.current = true;
    setRoutePlanningKey((k) => k + 1);
    setSheetOpen(false);
    setRoutePlanningOpen(true);
  }, []);

  const handleConfirmRoute = useCallback((start, end, profile) => {
    setConfirmedRoute({ start, end, profile });
    setRoutingActive(true);
    setRoutePlanningOpen(false);
  }, []);

  const handleSelectMapStyle = useCallback((nextStyle) => {
    if (Object.hasOwn(MAP_STYLES, nextStyle)) {
      setMapStyle(nextStyle);
    }
  }, []);

  // Waypoints for RoutingMachine — only set after the user confirms a route.
  const waypoints = useMemo(() => {
    if (!confirmedRoute) return null;
    const { start, end } = confirmedRoute;
    if (!start || !end) return null;
    if (start.equals(end)) return null;
    return [start, end];
  }, [confirmedRoute]);

  // Only render map when center position is determined
  if (!mapCenter) {
    return <div className="map-container">Loading your location...</div>;
  }

  return (
    <>
      <div className="map-wrapper">
        <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={true} className="map-container">
          <TileLayer
            key={mapStyle}
            attribution={MAP_STYLES[mapStyle].attribution}
            url={MAP_STYLES[mapStyle].url}
          />
          <ZoomToLocation position={position} />
          <LocationMarker position={position} onSelect={handlePositionSelect} placeName={locationInfo?.placeName} />
          <LocateControl onLocate={handleLocate} />
          <MapStyleControl
            style={mapStyle}
            styles={MAP_STYLES}
            onSelect={handleSelectMapStyle}
          />
          {routingActive && waypoints && (
            <RoutingMachine
              waypoints={waypoints}
              profile={confirmedRoute?.profile ?? 'car'}
              onRouteFound={setRouteInfo}
            />
          )}
        </MapContainer>
        <SearchControl onSelect={({ lat, lng }) => handlePositionSelect(L.latLng(lat, lng))} />
      </div>
      <LocationInfoSheet
        opened={sheetOpen}
        onClosed={() => {
          if (openingRoutePlanningRef.current) {
            openingRoutePlanningRef.current = false;
            setSheetOpen(false);
            return;
          }
          setSheetOpen(false);
          setRoutingActive(false);
          setRouteInfo(null);
          setConfirmedRoute(null);
          setPosition(null);
        }}
        locationInfo={locationInfo}
        loading={infoLoading}
        onShowRoute={handleShowRoute}
        routingActive={routingActive}
        routeInfo={routeInfo}
      />
      <RoutePlanningSheet
        key={routePlanningKey}
        opened={routePlanningOpen}
        onClosed={() => setRoutePlanningOpen(false)}
        destination={locationInfo}
        userPosition={userPosition}
        onConfirmRoute={handleConfirmRoute}
      />
    </>
  );
}

export default Map;
