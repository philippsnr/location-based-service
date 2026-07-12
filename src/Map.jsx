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
import { fetchAirQuality } from './services/airquality'
import { fetchWikidataFacts } from './services/wikidata'
import { GEO_DENIED_MESSAGE, getGeolocationPermissionState } from './services/geolocation'
import { POI_FILTERS, fetchPois } from './services/overpass'
import {
  getFavourites,
  toggleFavourite,
  removeFavourite,
  subscribe as subscribeFavourites,
} from './services/favourites'

/**
 * @file Map view root: renders the Leaflet map, wires up markers, POI results,
 * the info sheet, route planning and saved places. This is the single owner of
 * the app's map-related state (selected location, user position, active POI
 * filter, favourites, route).
 */

/** @typedef {[number, number]} LatLngTuple */

/**
 * The shape produced by {@link fetchLocationInfo} and consumed by
 * {@link module:./components/LocationInfoSheet}. `weatherInfo` and `elevation`
 * are attached later by the caller (`handlePositionSelect`) since they run in
 * parallel with the info fetch.
 *
 * @typedef {Object} LocationInfo
 * @property {string} placeName - Human-readable name for the selected point.
 * @property {number} lat
 * @property {number} lng
 * @property {string|null} wikiSummary - Wikipedia intro paragraph, or null.
 * @property {string|null} wikiUrl - Canonical Wikipedia article URL, or null.
 * @property {string[]} [wikiPhotos] - Commons hero photos (may be empty).
 * @property {Object|null} [facts] - Structured Wikidata facts (population/area/founded).
 * @property {string|null} [address] - Full street address from Nominatim, when a road is known.
 * @property {string|null} [country] - Full country name from Nominatim.
 * @property {string|null} [countryCode] - ISO 3166-1 alpha-2 code, lowercase.
 * @property {Object|null} [poi] - POI-specific details when this was opened from the POI layer.
 * @property {Object|null} [weatherInfo] - Weather + air quality bundle (attached by caller).
 * @property {number|null} [elevation] - Elevation in metres above sea level (attached by caller).
 */

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

/**
 * Normalise a coordinate value into a Leaflet `LatLng`.
 * Accepts `{lat, lng}` objects, `[lat, lng]` tuples, existing `L.LatLng`
 * instances, or nullish values.
 * @param {import('leaflet').LatLng | LatLngTuple | {lat: number, lng: number} | null | undefined} v
 * @returns {import('leaflet').LatLng | null} A LatLng, or null if input was falsy/unrecognised.
 */
function toLatLng(v) {
  if (!v) return null;
  if (v instanceof L.LatLng) return v;
  if (Array.isArray(v)) return L.latLng(v[0], v[1]);
  if (typeof v.lat === 'number' && typeof v.lng === 'number') return L.latLng(v.lat, v.lng);
  return null;
}

// DivIcon (rather than a plain L.Icon) so the marker image can carry a CSS
// drop-in animation. The image is re-mounted on each placement via a position
// key on <Marker>, which replays the animation.
const customMarkerIcon = new L.DivIcon({
  html: `<img src="${markerIconUrl}" width="32" height="32" alt="" class="map-marker__img" />`,
  className: 'map-marker',
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

/**
 * Keeps a ref pointed at the map's current centre so callbacks (e.g. POI fetch)
 * can read the latest centre without re-rendering when the map is panned.
 * @param {{ centerRef: import('react').MutableRefObject<import('leaflet').LatLng|null> }} props
 * @returns {null}
 */
function MapCenterTracker({ centerRef }) {
  const map = useMap();
  useMapEvents({ moveend() { centerRef.current = map.getCenter(); } });
  useEffect(() => { centerRef.current = map.getCenter(); }, [map, centerRef]);
  return null;
}

/**
 * Build a compact street-level address string from an OSM tag bag.
 * @param {Object<string, string>} tags - Raw OSM tags for a node/way (uses `addr:*` keys).
 * @returns {string|null} A one-line address like `"Main St 12, 24103 Kiel"`, or null if no address tags.
 */
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

/**
 * Resolve a Wikipedia summary for a location, preferring a user-typed search
 * name (`hint`) and falling back to the reverse-geocoded city so the sheet is
 * never empty.
 * @param {number} lat
 * @param {number} lng
 * @param {string|null} hint - Search-result name, if the user picked one.
 * @param {string|null} cityName - Reverse-geocoded city, town or village.
 * @returns {Promise<{title: string, language: string, summary: string, url: string}|null>}
 *   Wikipedia summary object, or null when nothing was found.
 */
async function resolveWikiSummary(lat, lng, hint, cityName) {
  if (hint) {
    const named = await wikipedia.getNamedLocationSummary(lat, lng, hint).catch(() => null);
    if (named) return named;
  }
  return wikipedia.getCityLocationSummary(lat, lng, cityName).catch(() => null);
}

/**
 * Resolve Wikimedia Commons hero photos for a location using the same
 * hint-first / city-fallback strategy as {@link resolveWikiSummary}.
 * @param {number} lat
 * @param {number} lng
 * @param {string|null} hint
 * @param {string|null} cityName
 * @returns {Promise<string[]>} Absolute image URLs; empty on failure or no matches.
 */
async function resolveHeroPhotos(lat, lng, hint, cityName) {
  if (hint) {
    const named = await wikipedia.getCommonsGeoPhotos(lat, lng, { cityName: hint }).catch(() => []);
    if (named.length) return named;
  }
  return wikipedia.getCommonsGeoPhotos(lat, lng, { cityName }).catch(() => []);
}

/**
 * Fetch the aggregate {@link LocationInfo} bundle for a coordinate.
 *
 * Runs reverse-geocoding, then Wikipedia summary + hero photos + Wikidata
 * facts in parallel. `hint` is the raw name of a selected search result; when
 * present it drives the Wikipedia/photo lookup and the displayed place name,
 * so searching "Bodensee" shows Bodensee rather than the nearest
 * reverse-geocoded city.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string|null} [hint=null]
 * @returns {Promise<LocationInfo>} The core info bundle. `weatherInfo` and
 *   `elevation` are attached separately by the caller.
 */
async function fetchLocationInfo(lat, lng, hint = null) {
  const { placeName, cityName, country, countryCode, address, osmType, osmClass } = await reverseGeocode(lat, lng);
  const searchName = hint?.split(',')[0].trim() || null;
  const [wikiResult, heroResult] = await Promise.allSettled([
    resolveWikiSummary(lat, lng, searchName, cityName),
    resolveHeroPhotos(lat, lng, searchName, cityName),
  ]);
  const wiki = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
  const wikiPhotos = heroResult.status === 'fulfilled' ? heroResult.value : [];
  // Structured city facts from Wikidata, looked up by the resolved Wikipedia
  // page title. Depends on that title, so it runs after the wiki lookup.
  const facts = wiki?.title
    ? await fetchWikidataFacts(wiki.title, `${wiki.language}wiki`).catch(() => null)
    : null;
  return {
    placeName: searchName ?? cityName ?? placeName,
    lat,
    lng,
    wikiSummary: wiki?.summary ?? null,
    wikiUrl: wiki?.url ?? null,
    wikiPhotos,
    facts,
    address,
    country,
    countryCode,
    osmType,
    osmClass,
  };
}

/**
 * @typedef {Object} LocationMarkerProps
 * @property {import('leaflet').LatLng | LatLngTuple | null} position - Where to draw the marker, or null to hide it.
 * @property {(latlng: import('leaflet').LatLng) => void} onSelect - Fires when the user clicks the map.
 * @property {string|null|undefined} placeName - Popup label; shows "Loading…" while resolving.
 */

/**
 * The click-to-place map pin: listens for map clicks, hands the coordinate off
 * to `onSelect`, and renders the current selection with a drop-in animation.
 * @param {LocationMarkerProps} props
 * @returns {import('react').ReactElement | null}
 */
function LocationMarker({ position, onSelect, placeName }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });

  if (position === null) return null;
  // Re-mount the marker whenever the target moves so the drop-in animation
  // replays on each new placement.
  const ll = toLatLng(position);
  const key = ll ? `${ll.lat},${ll.lng}` : 'marker';
  return (
    <Marker key={key} position={position} icon={customMarkerIcon}>
      <Popup>{placeName ?? 'Loading…'}</Popup>
    </Marker>
  );
}

const ZOOM_BY_FEATURE = {
  // place types
  city: 13,
  town: 13,
  village: 14,
  hamlet: 14,
  suburb: 14,
  neighbourhood: 15,
  // water / natural
  water: 11,
  lake: 11,
  river: 11,
  sea: 8,
  ocean: 5,
  forest: 13,
  park: 13,
  nature_reserve: 12,
  // admin boundaries
  country: 5,
  state: 7,
  county: 10,
  administrative: 12,
  // street / POI
  road: 17,
  street: 17,
  house: 18,
  building: 18,
  amenity: 17,
  tourism: 17,
  shop: 17,
};

/**
 * Derive a sensible zoom level from Nominatim's `type` and `class` fields.
 * @param {string|null} osmType
 * @param {string|null} osmClass
 * @returns {number}
 */
function deriveZoom(osmType, osmClass) {
  return ZOOM_BY_FEATURE[osmType] ?? ZOOM_BY_FEATURE[osmClass] ?? 15;
}

/**
 * Smoothly flies the map to `position` on every change. Renders nothing.
 * @param {{ position: import('leaflet').LatLng | LatLngTuple | null, osmType: string|null, osmClass: string|null }} props
 * @returns {null}
 */
function ZoomToLocation({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const zoom = deriveZoom(target.osmType, target.osmClass);

    // Shift the fly-to centre so the marker lands in the middle of the visible
    // area (between search bar and info sheet) rather than the screen centre.
    const sheetHeight = target.sheetOpen ? Math.round(window.innerHeight * 0.67) : 0;
    const searchBarHeight = 56;
    const offsetPx = (sheetHeight - searchBarHeight) / 2;

    if (offsetPx > 0) {
      const targetPoint = map.project(target.position, zoom);
      const adjustedPoint = targetPoint.subtract([0, -offsetPx]);
      const adjustedLatLng = map.unproject(adjustedPoint, zoom);
      map.flyTo(adjustedLatLng, zoom, { duration: 1.5 });
    } else {
      map.flyTo(target.position, zoom, { duration: 1.5 });
    }
  }, [target, map]);

  return null;
}

/**
 * Fits the map view to enclose the current POI markers. No-op when the list
 * is empty; runs on every change to `poiMarkers`.
 * @param {{ poiMarkers: Array<{ lat: number, lng: number }> }} props
 * @returns {null}
 */
function FitBoundsOnPoi({ poiMarkers }) {
  const map = useMap();

  useEffect(() => {
    if (!poiMarkers.length) return;
    const bounds = L.latLngBounds(poiMarkers.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [poiMarkers, map]);

  return null;
}

/**
 * Root map view. Owns the app's map-related state (selected position, user
 * position, active POI filter, info sheet visibility, route planning, saved
 * places) and orchestrates the child controls and sheets.
 *
 * Takes no props — all state is internal.
 * @returns {import('react').ReactElement}
 */
function Map() {
  const [position, setPosition] = useState(null);
  const [zoomTarget, setZoomTarget] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
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
  // Actionable message shown when a location action is blocked/denied.
  const [geoMessage, setGeoMessage] = useState('');
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

  useEffect(() => {
    if (!geoMessage) return;
    const t = window.setTimeout(() => setGeoMessage(''), 6000);
    return () => window.clearTimeout(t);
  }, [geoMessage]);

  const handlePositionSelect = useCallback(async (latlng, hint = null, { collapsed = false, osmType: hintOsmType = null } = {}) => {
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
      const [infoResult, weatherResult, elevationResult, airQualityResult] = await Promise.allSettled([
        fetchLocationInfo(lat, lng, hint),
        fetchWeather(lat, lng),
        fetchElevation(lat, lng),
        fetchAirQuality(lat, lng),
      ]);
      const info = infoResult.status === 'fulfilled'
        ? infoResult.value
        : { placeName: hint ?? 'Unknown location', lat, lng, wikiSummary: null, wikiUrl: null };
      const baseWeather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      const elevation = elevationResult.status === 'fulfilled' ? elevationResult.value : null;
      const airQuality = airQualityResult.status === 'fulfilled' ? airQualityResult.value : null;
      const weatherInfo = baseWeather ? { ...baseWeather, airQuality } : null;
      setLocationInfo({ ...info, weatherInfo, elevation, osmType: hintOsmType ?? info.osmType, osmClass: info.osmClass });
      setZoomTarget({ position: L.latLng(lat, lng), osmType: hintOsmType ?? info.osmType ?? null, osmClass: info.osmClass ?? null, sheetOpen: true });
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

  const handleLocate = useCallback((latlng, accuracy) => {
    const ll = toLatLng(latlng);
    if (!ll) return;
    setUserPosition(ll);
    if (accuracy != null) setUserAccuracy(accuracy);
    handlePositionSelect(ll);
  }, [handlePositionSelect]);

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
          const { latitude, longitude, accuracy } = pos.coords;
          const userLatLng = L.latLng(latitude, longitude);
          setMapCenter([latitude, longitude]);
          setUserPosition(userLatLng);
          setUserAccuracy(accuracy);
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
    // Routing needs the user's position as the start point. If location is
    // blocked we still open the planner (a start can be typed manually) but
    // tell the user why "My Location" is unavailable instead of failing mutely.
    if (!userPosition) {
      getGeolocationPermissionState().then((state) => {
        if (state === 'denied') setGeoMessage(GEO_DENIED_MESSAGE);
      });
    }
  }, [userPosition]);

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
      osmType: locationInfo.osmType ?? null,
    });
  }, [locationInfo]);

  const handleSelectFavourite = useCallback((fav) => {
    setSavedPlacesOpen(false);
    handlePositionSelect(L.latLng(fav.lat, fav.lng), fav.placeName, { osmType: fav.osmType ?? null });
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
        {geoMessage && (
          <div className="geo-toast" role="alert">
            <span className="geo-toast__text">{geoMessage}</span>
            <button
              type="button"
              className="geo-toast__close"
              onClick={() => setGeoMessage('')}
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
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
          <ZoomToLocation target={zoomTarget} />
          <LocationMarker position={isPoiSheet ? null : position} onSelect={handlePositionSelect} placeName={locationInfo?.placeName} />
          <UserLocationMarker position={userPosition} accuracy={userAccuracy} />
          <LocateControl onLocate={handleLocate} onError={setGeoMessage} />
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
        <SearchControl onSelect={({ lat, lng, name, type }) => handlePositionSelect(L.latLng(lat, lng), name, { osmType: type })} />
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
          setZoomTarget(null);
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
