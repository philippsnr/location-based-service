import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIconUrl from './assets/marker.png';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import LocateControl from './components/LocateControl';
import UserLocationMarker from './components/UserLocationMarker';
import MapStyleControl from './components/MapStyleControl';
import LocationInfoSheet from './components/LocationInfoSheet';
import RoutePlanningSheet from './components/RoutePlanningSheet';
import RoutingMachine from './components/RoutingMachine';
import SearchControl from './components/SearchControl';
import PoiFilterBar from './components/PoiFilterBar';
import PoiResultsSheet from './components/PoiResultsSheet';
import ScaleControl from './components/ScaleControl';
import SavedPlacesSheet from './components/SavedPlacesSheet';
import { reverseGeocode } from './services/nominatim';
import wikipedia from './services/wikipedia'
import { fetchWeather } from './services/weather'
import { fetchElevation } from './services/elevation'
import { POI_FILTERS, fetchPois } from './services/overpass'
import {
  getFavourites,
  toggleFavourite,
  removeFavourite,
  subscribe as subscribeFavourites,
} from './services/favourites'

const defaultPosition = [54.4047, 10.2256];
const MAP_STYLE_STORAGE_KEY = 'map-style';

const MAP_STYLES = {
  standard: {
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  topo: {
    label: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    // OpenTopoMap only serves tiles up to zoom 17; upscale them beyond that
    // instead of showing blank tiles.
    maxNativeZoom: 17,
  },
};

// Cycle order for the map style toggle button.
const MAP_STYLE_CYCLE = ['standard', 'satellite', 'topo'];

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

const poiIconByFilter = Object.fromEntries(
  POI_FILTERS.map(f => [
    f.id,
    new L.DivIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${f.color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',
    }),
  ])
);

function MapCenterTracker({ centerRef }) {
  const map = useMap();
  useMapEvents({ moveend() { centerRef.current = map.getCenter(); } });
  useEffect(() => { centerRef.current = map.getCenter(); }, [map, centerRef]);
  return null;
}

function buildPoiAddress(tags) {
  const street = tags['addr:street'];
  const num = tags['addr:housenumber'];
  const post = tags['addr:postcode'];
  const city = tags['addr:city'];
  const parts = [];
  if (street) parts.push(num ? `${street} ${num}` : street);
  if (post || city) parts.push([post, city].filter(Boolean).join(' '));
  return parts.join(', ') || null;
}

// Resolve a Wikipedia summary, preferring a user-typed search name (hint) and
// falling back to the reverse-geocoded city so the sheet is never empty.
async function resolveWikiSummary(lat, lng, hint, cityName) {
  if (hint) {
    const named = await wikipedia.getNamedLocationSummary(lat, lng, hint).catch(() => null);
    if (named) return named;
  }
  return wikipedia.getCityLocationSummary(lat, lng, cityName).catch(() => null);
}

// Hero photos, same hint-first / city-fallback strategy. Returns an array.
async function resolveHeroPhotos(lat, lng, hint, cityName) {
  if (hint) {
    const named = await wikipedia.getCommonsGeoPhotos(lat, lng, { cityName: hint }).catch(() => []);
    if (named.length) return named;
  }
  return wikipedia.getCommonsGeoPhotos(lat, lng, { cityName }).catch(() => []);
}

// `hint` is the name of a selected search result. When present it drives the
// Wikipedia/photo lookup and the displayed place name, so searching "Bodensee"
// shows Bodensee rather than the nearest reverse-geocoded city.
async function fetchLocationInfo(lat, lng, hint = null) {
  const { placeName, cityName, country, countryCode } = await reverseGeocode(lat, lng);
  const searchName = hint?.split(',')[0].trim() || null;
  const [wikiResult, heroResult] = await Promise.allSettled([
    resolveWikiSummary(lat, lng, searchName, cityName),
    resolveHeroPhotos(lat, lng, searchName, cityName),
  ]);
  const wiki = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
  const wikiPhotos = heroResult.status === 'fulfilled' ? heroResult.value : [];
  return {
    placeName: searchName ?? cityName ?? placeName,
    lat,
    lng,
    wikiSummary: wiki?.summary ?? null,
    wikiUrl: wiki?.url ?? null,
    wikiPhotos,
    country,
    countryCode,
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

function FitBoundsOnPoi({ poiMarkers }) {
  const map = useMap();

  useEffect(() => {
    if (!poiMarkers.length) return;
    const bounds = L.latLngBounds(poiMarkers.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [poiMarkers, map]);

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
  const [activeFilter, setActiveFilter] = useState(null);
  const [poiMarkers, setPoiMarkers] = useState([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiError, setPoiError] = useState(false);
  const [poiListOpen, setPoiListOpen] = useState(false);
  const [isPoiSheet, setIsPoiSheet] = useState(false);
  const [favourites, setFavourites] = useState(() => getFavourites());
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [autoOpenCollapsed, setAutoOpenCollapsed] = useState(false);
  const mapCenterRef = useRef(null);
  const activeFilterRef = useRef(null);
  const poiAbortRef = useRef(null);
  const openingRoutePlanningRef = useRef(false);
  // Issue #133: ensure the on-mount current-city auto-open fires at most once.
  const autoOpenedRef = useRef(false);
  // Set to true before closing PoiResultsSheet programmatically so onSheetClosed
  // doesn't mistake it for a user dismissal and deactivate the filter.
  const closingPoiListProgramRef = useRef(false);

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

  useEffect(() => {
    return subscribeFavourites(() => setFavourites(getFavourites()));
  }, []);

  const handlePositionSelect = useCallback(async (latlng, hint = null, { collapsed = false } = {}) => {
    const lat = latlng.lat ?? latlng[0];
    const lng = latlng.lng ?? latlng[1];
    setIsPoiSheet(false);
    setPosition(latlng);
    setAutoOpenCollapsed(collapsed);
    setSheetOpen(true);
    setInfoLoading(true);
    setLocationInfo(null);
    setRoutingActive(false);
    setRouteInfo(null);
    setConfirmedRoute(null);
    setRoutePlanningOpen(false);
    try {
      const [infoResult, weatherResult, elevationResult] = await Promise.allSettled([
        fetchLocationInfo(lat, lng, hint),
        fetchWeather(lat, lng),
        fetchElevation(lat, lng),
      ]);
      const info = infoResult.status === 'fulfilled'
        ? infoResult.value
        : { placeName: hint ?? 'Unknown location', lat, lng, wikiSummary: null, wikiUrl: null };
      const weatherInfo = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      const elevation = elevationResult.status === 'fulfilled' ? elevationResult.value : null;
      setLocationInfo({ ...info, weatherInfo, elevation });
    } catch (err) {
      console.warn('Failed to fetch location info:', err);
      setLocationInfo({ placeName: hint ?? 'Unknown location', lat, lng, wikiSummary: null, wikiUrl: null, weatherInfo: null });
    } finally {
      setInfoLoading(false);
    }
  }, []);

  const handlePoiSelect = useCallback((poi) => {
    const latlng = L.latLng(poi.lat, poi.lng);
    setIsPoiSheet(true);
    setPosition(latlng);
    setAutoOpenCollapsed(false);
    setSheetOpen(true);
    setInfoLoading(true);
    setLocationInfo(null);
    setRoutingActive(false);
    setRouteInfo(null);
    setConfirmedRoute(null);
    setRoutePlanningOpen(false);
    const tags = poi.tags ?? {};
    setLocationInfo({
      placeName: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      wikiSummary: null,
      wikiUrl: null,
      poi: {
        type: poi.filterType,
        address: buildPoiAddress(tags),
        openingHours: tags['opening_hours'] ?? null,
        website: tags['website'] ?? tags['contact:website'] ?? null,
        phone: tags['phone'] ?? tags['contact:phone'] ?? null,
        cuisine: tags['cuisine'] ?? null,
        operator: tags['operator'] ?? null,
        wheelchair: tags['wheelchair'] ?? null,
      },
    });
    setInfoLoading(false);
  }, []);

  const handleLocate = useCallback((latlng) => {
    // Refresh the route origin only; do not change the selected target or open the info sheet.
    const ll = toLatLng(latlng);
    if (ll) setUserPosition(ll);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    if (!isNaN(lat) && !isNaN(lng)) {
      handlePositionSelect(L.latLng(lat, lng));
    }
  }, [handlePositionSelect]);

  useEffect(() => {
    // Request user's geolocation on component mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const userLatLng = L.latLng(latitude, longitude);
          setMapCenter([latitude, longitude]);
          setUserPosition(userLatLng);
          // Issue #133: auto-open the info sheet (collapsed) for the user's
          // current city on first load — but only if the user hasn't already
          // arrived via a ?lat=&lng= deep link, and only once per mount.
          if (!autoOpenedRef.current) {
            const params = new URLSearchParams(window.location.search);
            const hasDeepLink = !isNaN(parseFloat(params.get('lat'))) && !isNaN(parseFloat(params.get('lng')));
            if (!hasDeepLink) {
              autoOpenedRef.current = true;
              handlePositionSelect(userLatLng, null, { collapsed: true });
            }
          }
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

  const handleShowRoute = useCallback(() => {
    openingRoutePlanningRef.current = true;
    setRoutePlanningKey((k) => k + 1);
    setSheetOpen(false);
    setRoutePlanningOpen(true);
  }, []);

  const handleConfirmRoute = useCallback((start, end, profile) => {
    setConfirmedRoute({ start, end, profile });
    setRoutingActive(true);
    // Keep the sheet open so the user can cancel the route
  }, []);

  const handleCancelRoute = useCallback(() => {
    setRoutingActive(false);
    setRouteInfo(null);
    setConfirmedRoute(null);
    setRoutePlanningOpen(false);
    setPosition(null);
  }, []);

  const handleToggleMapStyle = useCallback(() => {
    setMapStyle((currentStyle) => {
      const currentIndex = MAP_STYLE_CYCLE.indexOf(currentStyle);
      return MAP_STYLE_CYCLE[(currentIndex + 1) % MAP_STYLE_CYCLE.length];
    });
  }, []);

  const handleFilterToggle = useCallback(async (filterId) => {
    poiAbortRef.current?.abort();
    poiAbortRef.current = null;

    if (activeFilterRef.current === filterId) {
      activeFilterRef.current = null;
      setActiveFilter(null);
      setPoiMarkers([]);
      setPoiError(false);
      setPoiLoading(false);
      return;
    }
    activeFilterRef.current = filterId;
    setActiveFilter(filterId);
    setPoiMarkers([]);
    setPoiError(false);
    const center = mapCenterRef.current;
    if (!center) return;
    setPoiLoading(true);

    const controller = new AbortController();
    poiAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const pois = await fetchPois(center.lat, center.lng, filterId, controller.signal);
      clearTimeout(timeoutId);
      if (activeFilterRef.current === filterId) {
        setPoiMarkers(pois);
        setPoiLoading(false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // AbortError with a different active filter = user switched away, discard silently
      if (err.name === 'AbortError' && activeFilterRef.current !== filterId) return;
      console.warn('Failed to fetch POIs:', err);
      if (activeFilterRef.current === filterId) {
        setPoiError(true);
        setPoiLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const hasResults = poiMarkers.length > 0 && !!activeFilter;
    const overlayOpen = sheetOpen || routePlanningOpen;
    if (hasResults && !overlayOpen) {
      closingPoiListProgramRef.current = false;
      setPoiListOpen(true);
    } else {
      if (hasResults && overlayOpen) {
        // Another sheet is covering the map — close list without deactivating filter.
        closingPoiListProgramRef.current = true;
      }
      setPoiListOpen(false);
    }
  }, [poiMarkers.length, activeFilter, sheetOpen, routePlanningOpen]);

  const handlePoiListClose = useCallback(() => {
    if (closingPoiListProgramRef.current) {
      closingPoiListProgramRef.current = false;
      return;
    }
    setPoiListOpen(false);
    if (activeFilterRef.current) {
      handleFilterToggle(activeFilterRef.current);
    }
  }, [handleFilterToggle]);

  const distanceToUser = useMemo(() => {
    if (!userPosition || !position) return null;
    return userPosition.distanceTo(position);
  }, [userPosition, position]);

  const currentIsFavourite = useMemo(() => {
    if (!locationInfo?.lat || !locationInfo?.lng) return false;
    return favourites.some(
      (f) =>
        Math.abs(f.lat - locationInfo.lat) < 1e-5 &&
        Math.abs(f.lng - locationInfo.lng) < 1e-5
    );
  }, [locationInfo?.lat, locationInfo?.lng, favourites]);

  const handleToggleFavourite = useCallback(() => {
    if (!locationInfo?.lat || !locationInfo?.lng) return;
    toggleFavourite({
      placeName: locationInfo.placeName,
      lat: locationInfo.lat,
      lng: locationInfo.lng,
    });
  }, [locationInfo]);

  const handleSelectFavourite = useCallback((fav) => {
    setSavedPlacesOpen(false);
    handlePositionSelect(L.latLng(fav.lat, fav.lng));
  }, [handlePositionSelect]);

  const handleRemoveFavourite = useCallback((fav) => {
    removeFavourite(fav.lat, fav.lng);
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
    return (
      <div className="loading-screen">
        <div className="loading-screen__icon">🗺️</div>
        <div className="loading-screen__spinner" aria-hidden="true" />
        <p className="loading-screen__text">Finding your location…</p>
      </div>
    );
  }

  return (
    <>
      <div className="map-wrapper">
        <MapContainer
          center={mapCenter}
          zoom={15}
          scrollWheelZoom={true}
          zoomControl={false}
          className="map-container"
        >
          <TileLayer
            key={mapStyle}
            attribution={MAP_STYLES[mapStyle].attribution}
            url={MAP_STYLES[mapStyle].url}
            maxNativeZoom={MAP_STYLES[mapStyle].maxNativeZoom}
          />
          {mapStyle === 'satellite' && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution=""
              zIndex={2}
            />
          )}
          <ZoomToLocation position={position} />
          <LocationMarker position={isPoiSheet ? null : position} onSelect={handlePositionSelect} placeName={locationInfo?.placeName} />
          <UserLocationMarker position={userPosition} />
          <LocateControl onLocate={handleLocate} />
          <ScaleControl />
          <MapStyleControl style={mapStyle} onToggle={handleToggleMapStyle} />
          <MapCenterTracker centerRef={mapCenterRef} />
          <FitBoundsOnPoi poiMarkers={poiMarkers} />
          {poiMarkers.map(poi => (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lng]}
              icon={poiIconByFilter[activeFilter] ?? poiIconByFilter.restaurant}
              eventHandlers={{ click: (e) => { e.originalEvent?.stopPropagation(); handlePoiSelect(poi); } }}
            >
              <Tooltip direction="top" offset={[0, -8]}>{poi.name}</Tooltip>
            </Marker>
          ))}
          {routingActive && waypoints && (
            <RoutingMachine
              waypoints={waypoints}
              profile={confirmedRoute?.profile ?? 'car'}
              onRouteFound={setRouteInfo}
            />
          )}
        </MapContainer>
        <SearchControl onSelect={({ lat, lng, name }) => handlePositionSelect(L.latLng(lat, lng), name)} />
        <PoiFilterBar activeFilter={activeFilter} loading={poiLoading} error={poiError} onToggle={handleFilterToggle} />
        <button
          type="button"
          className={`saved-places-fab${favourites.length > 0 ? ' saved-places-fab--has-items' : ''}`}
          onClick={() => setSavedPlacesOpen(true)}
          aria-label="Open saved places"
          title="Saved places"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {favourites.length > 0 && (
            <span className="saved-places-fab__badge">{favourites.length}</span>
          )}
        </button>
      </div>
      <PoiResultsSheet
        opened={poiListOpen}
        onClosed={handlePoiListClose}
        pois={poiMarkers}
        userPosition={userPosition}
        activeFilter={activeFilter}
        onSelectPoi={handlePoiSelect}
      />
      <LocationInfoSheet
        opened={sheetOpen}
        onClosed={() => {
          if (openingRoutePlanningRef.current) {
            openingRoutePlanningRef.current = false;
            setSheetOpen(false);
            return;
          }
          setSheetOpen(false);
          setIsPoiSheet(false);
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
        distanceToUser={distanceToUser}
        isFavourite={currentIsFavourite}
        onToggleFavourite={handleToggleFavourite}
        initialCollapsed={autoOpenCollapsed}
      />
      <RoutePlanningSheet
        key={routePlanningKey}
        opened={routePlanningOpen}
        onClosed={() => setRoutePlanningOpen(false)}
        destination={locationInfo}
        userPosition={userPosition}
        onConfirmRoute={handleConfirmRoute}
        onCancelRoute={handleCancelRoute}
      />
      <SavedPlacesSheet
        opened={savedPlacesOpen}
        onClosed={() => setSavedPlacesOpen(false)}
        favourites={favourites}
        userPosition={userPosition}
        onSelect={handleSelectFavourite}
        onRemove={handleRemoveFavourite}
      />
    </>
  );
}

export default Map;
