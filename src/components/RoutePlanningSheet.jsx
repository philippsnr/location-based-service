import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sheet } from 'framework7-react';
import L from 'leaflet';
import { forwardGeocode } from '../services/nominatim';
import { fetchElevationProfile } from '../services/elevationProfile';
import ElevationChart from './ElevationChart';

/**
 * @file Bottom sheet for planning a route: from/to address autocomplete,
 * travel-mode selection (drive/walk/bike), a live distance/duration preview and
 * elevation profile, and confirm/cancel. Owns its own peek/expand drag
 * interaction and collapses to an "Active Route" header once confirmed.
 */

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;
const PEEK_HEIGHT = 80;
const DRAG_THRESHOLD = 20;
const SNAP_THRESHOLD = 50;
const SNAP_DURATION = 300;

/** @returns {number} Height in px for the "expanded" snap position (capped at 680). */
function getFullHeight() {
  return Math.min(680, Math.round(window.innerHeight * 0.9));
}

/**
 * Animate `sheetEl` to `targetHeight`, then invoke `onDone`. Uses both the
 * `transitionend` event and a safety timeout so we still fire `onDone` when
 * the transition is preempted or the height is already at target.
 * @param {HTMLElement} sheetEl
 * @param {number} targetHeight - Target height in px.
 * @param {() => void} onDone
 * @returns {void}
 */
function snapTo(sheetEl, targetHeight, onDone) {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    sheetEl.removeEventListener('transitionend', onTransEnd);
    onDone();
    sheetEl.style.height = '';
    sheetEl.style.transition = '';
  };
  const onTransEnd = (ev) => {
    if (ev.propertyName === 'height') finish();
  };
  sheetEl.style.transition = `transform var(--f7-sheet-transition-duration), height ${SNAP_DURATION}ms ease`;
  sheetEl.style.height = `${targetHeight}px`;
  sheetEl.addEventListener('transitionend', onTransEnd);
  setTimeout(finish, SNAP_DURATION + 50);
}

/** @param {number} meters @returns {string} Distance formatted as `"m"` under 1 km, else `"km"` with one decimal. */
function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/** @param {number} seconds @returns {string} Duration formatted as `"h min"` (dropping hours below 1 h). */
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

// routing.openstreetmap.de has separate servers per profile with correct data.
// router.project-osrm.org only carries the car graph and silently returns car
// results for any profile name, making foot indistinguishable from driving.
const OSRM_BASE = {
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
};

/**
 * Fetch a route preview between two coordinates for a travel profile.
 * @param {{lat: number, lng: number}} start - Start coordinate.
 * @param {{lat: number, lng: number}} end - End coordinate.
 * @param {'car'|'foot'|'bike'} profile - Travel profile (falls back to car).
 * @param {AbortSignal} [signal] - Optional signal to cancel the request.
 * @returns {Promise<{distance: number, duration: number, geometry: Array<[number, number]>}|null>}
 *   Distance (m), duration (s) and GeoJSON geometry, or null when no route found.
 */
async function fetchRoutePreview(start, end, profile, signal) {
  const base = OSRM_BASE[profile] ?? OSRM_BASE.car;
  const url = `${base}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry.coordinates,
  };
}

/**
 * @typedef {Object} AddressFieldProps
 * @property {string} label - Field label ("From"/"To").
 * @property {string} query - Current text value (controlled).
 * @property {(value: string) => void} setQuery - Updates the text value.
 * @property {import('leaflet').LatLng | null} coords - Resolved coordinate, or null while unresolved.
 * @property {(coords: import('leaflet').LatLng | null) => void} setCoords - Sets/clears the resolved coordinate.
 * @property {string} placeholder - Input placeholder text.
 */

/**
 * A single address input with debounced forward-geocoding autocomplete. Shows a
 * results dropdown; selecting a result sets both the text and coordinates.
 * Searching is suppressed once a coordinate is resolved.
 * @param {AddressFieldProps} props
 * @returns {import('react').ReactElement}
 */
function AddressField({ label, query, setQuery, coords, setCoords, placeholder }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    // Already resolved — no need to search
    if (coords !== null) {
      setResults([]);
      setOpen(false);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      if (abortRef.current) abortRef.current.abort();
      setResults([]);
      setSearching(false);
      setOpen(false);
      return;
    }

    const handle = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      try {
        const items = await forwardGeocode(trimmed, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) {
          setResults(items);
          setOpen(items.length > 0);
          setSearching(false);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          if (err.name !== 'AbortError') setResults([]);
          setSearching(false);
          setOpen(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, coords]);

  const handleSelect = (item) => {
    if (abortRef.current) abortRef.current.abort();
    setResults([]);
    setOpen(false);
    setQuery(item.name);
    setCoords(L.latLng(item.lat, item.lng));
  };

  return (
    <div className="route-sheet__field">
      <label className="route-sheet__field-label">{label}</label>
      <div className="route-sheet__field-wrap">
        <input
          type="text"
          className="route-sheet__field-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCoords(null);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
        />
        {query && (
          <button
            type="button"
            className="route-sheet__field-clear"
            onClick={() => {
              if (abortRef.current) abortRef.current.abort();
              setQuery('');
              setCoords(null);
              setResults([]);
              setOpen(false);
            }}
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>
      {open && (searching || results.length > 0) && (
        <ul className="route-sheet__results">
          {searching && (
            <li className="route-sheet__results-status">Searching…</li>
          )}
          {!searching &&
            results.map((r, i) => (
              <li
                key={`${r.lat},${r.lng},${i}`}
                className="route-sheet__result-item"
                onClick={() => handleSelect(r)}
              >
                <div className="route-sheet__result-name">
                  <span className="route-sheet__result-name-text">{r.name}</span>
                  {r.type && <span className="place-type-badge">{r.type}</span>}
                </div>
                {r.country && (
                  <div className="route-sheet__result-country">{r.country}</div>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/**
 * @typedef {Object} RoutePlanningSheetProps
 * @property {boolean} opened - Whether the sheet should be visible.
 * @property {() => void} onClosed - Fires after the sheet closes.
 * @property {{placeName?: string, lat?: number, lng?: number} | null} destination - Pre-fills the "To" field.
 * @property {import('leaflet').LatLng | null} userPosition - Pre-fills the "From" field with "My Location" when present.
 * @property {(start: import('leaflet').LatLng, end: import('leaflet').LatLng, mode: 'car'|'foot'|'bike') => void} onConfirmRoute - Fires when the user taps "Get Directions".
 * @property {() => void} onCancelRoute - Fires when an active route is cancelled.
 */

/**
 * Route planning bottom sheet. Lets the user pick start/end and travel mode,
 * shows a live route preview and elevation profile, then confirms the route
 * (after which it collapses to a compact "Active Route" header).
 * @param {RoutePlanningSheetProps} props
 * @returns {import('react').ReactElement}
 */
export default function RoutePlanningSheet({
  opened,
  onClosed,
  destination,
  userPosition,
  onConfirmRoute,
  onCancelRoute,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [routeActive, setRouteActive] = useState(false);
  const isExpandedRef = useRef(false);
  const dragRef = useRef({ dragged: false });
  const sheetElRef = useRef(null);

  const [startQuery, setStartQuery] = useState(userPosition ? 'My Location' : '');
  const [startCoords, setStartCoords] = useState(userPosition ?? null);
  const [endQuery, setEndQuery] = useState(destination?.placeName ?? '');
  const [endCoords, setEndCoords] = useState(
    destination?.lat != null ? L.latLng(destination.lat, destination.lng) : null
  );
  const [travelMode, setTravelMode] = useState('car');
  const [routePreview, setRoutePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [elevationProfile, setElevationProfile] = useState(null);
  const [elevationLoading, setElevationLoading] = useState(false);
  const [elevationError, setElevationError] = useState(false);

  const applyExpanded = useCallback((value) => {
    isExpandedRef.current = value;
    setIsExpanded(value);
  }, []);

  const handleClose = useCallback(() => {
    if (sheetElRef.current) {
      sheetElRef.current.style.height = '';
      sheetElRef.current.style.transition = '';
    }
    applyExpanded(false);
    onClosed();
  }, [onClosed, applyExpanded]);

  const handleCancelRoute = useCallback(() => {
    if (sheetElRef.current) {
      sheetElRef.current.style.height = '';
      sheetElRef.current.style.transition = '';
    }
    applyExpanded(false);
    setRouteActive(false);
    onCancelRoute?.();
  }, [onCancelRoute, applyExpanded]);

  const handlePointerDown = (e) => {
    const sheetEl = e.currentTarget.closest('.sheet-modal');
    if (!sheetEl) return;
    sheetElRef.current = sheetEl;

    const fullHeight = getFullHeight();
    const startY = e.clientY;
    const startHeight = sheetEl.offsetHeight;
    dragRef.current.dragged = false;

    sheetEl.style.transition = 'transform var(--f7-sheet-transition-duration)';

    const onMove = (ev) => {
      const newH = Math.min(fullHeight, Math.max(PEEK_HEIGHT, startHeight + (startY - ev.clientY)));
      sheetEl.style.height = `${newH}px`;
    };

    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      const totalDrag = startY - ev.clientY;
      if (Math.abs(totalDrag) > DRAG_THRESHOLD) dragRef.current.dragged = true;

      const fullH = getFullHeight();
      let shouldExpand;
      if (Math.abs(totalDrag) > SNAP_THRESHOLD) {
        shouldExpand = totalDrag > 0;
      } else {
        shouldExpand = isExpandedRef.current;
      }
      const targetH = shouldExpand ? fullH : PEEK_HEIGHT;

      snapTo(sheetEl, targetH, () => {
        flushSync(() => applyExpanded(shouldExpand));
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleClick = (e) => {
    if (dragRef.current.dragged) {
      dragRef.current.dragged = false;
      return;
    }
    const sheetEl = e.currentTarget.closest('.sheet-modal');
    if (!sheetEl) return;
    sheetElRef.current = sheetEl;

    const newExpanded = !isExpandedRef.current;
    const fullH = getFullHeight();
    const targetH = newExpanded ? fullH : PEEK_HEIGHT;

    snapTo(sheetEl, targetH, () => {
      flushSync(() => applyExpanded(newExpanded));
    });
  };

  useEffect(() => {
    if (!opened) {
      applyExpanded(false);
      setRouteActive(false);
      return;
    }
    applyExpanded(true);
  }, [opened, applyExpanded]);

  useEffect(() => {
    if (!startCoords || !endCoords) {
      setRoutePreview(null);
      setPreviewError(false);
      setElevationProfile(null);
      setElevationLoading(false);
      setElevationError(false);
      return;
    }

    const ctrl = new AbortController();
    setPreviewLoading(true);
    setRoutePreview(null);
    setPreviewError(false);
    setElevationProfile(null);
    setElevationLoading(false);
    setElevationError(false);

    fetchRoutePreview(startCoords, endCoords, travelMode, ctrl.signal)
      .then(async (preview) => {
        if (ctrl.signal.aborted) return;
        setRoutePreview(preview);
        if (!preview) {
          setPreviewError(true);
          setPreviewLoading(false);
          return;
        }
        setPreviewLoading(false);
        setElevationLoading(true);
        try {
          const elevations = await fetchElevationProfile(preview.geometry, ctrl.signal);
          if (!ctrl.signal.aborted) {
            setElevationProfile(elevations);
            setElevationLoading(false);
          }
        } catch (err) {
          if (!ctrl.signal.aborted && err.name !== 'AbortError') {
            setElevationError(true);
            setElevationLoading(false);
          }
        }
      })
      .catch((err) => {
        if (!ctrl.signal.aborted && err.name !== 'AbortError') {
          setPreviewError(true);
          setPreviewLoading(false);
        }
      });

    return () => ctrl.abort();
  }, [startCoords, endCoords, travelMode]);

  const handleConfirm = () => {
    if (!startCoords || !endCoords) return;
    onConfirmRoute(startCoords, endCoords, travelMode);
    setRouteActive(true);
    const sheetEl = sheetElRef.current ?? document.querySelector('.route-planning-sheet.sheet-modal');
    if (sheetEl) {
      sheetElRef.current = sheetEl;
      snapTo(sheetEl, PEEK_HEIGHT, () => {
        flushSync(() => applyExpanded(false));
      });
    }
  };

  const closeIcon = (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  return (
    <Sheet
      className={`route-planning-sheet${isExpanded ? ' route-planning-sheet--expanded' : ''}${routeActive ? ' route-planning-sheet--active' : ''}`}
      opened={opened}
      onSheetClosed={handleClose}
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
    >
      <div
        className={`route-planning-sheet__header sheet-modal-swipe-step${routeActive ? ' route-planning-sheet__header--active' : ''}`}
        onPointerDown={routeActive ? undefined : handlePointerDown}
        onClick={routeActive ? undefined : handleClick}
      >
        {!routeActive && <div className="location-info-sheet__handle" />}
        <div className="route-planning-sheet__title-row">
          {routeActive ? (
            <>
              <div className="route-sheet__active-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
              </div>
              <div className="route-sheet__active-info">
                <span className="route-sheet__active-label">Active Route</span>
                {routePreview && (
                  <div className="route-sheet__active-metrics">
                    <span className="route-sheet__active-distance">
                      {formatDistance(routePreview.distance)}
                    </span>
                    <span className="route-sheet__active-sep">·</span>
                    <span className="route-sheet__active-duration">
                      {formatDuration(routePreview.duration)}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="route-planning-sheet__title">Plan Route</span>
          )}
          <button
            className="location-info-sheet__close-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (routeActive) handleCancelRoute();
              else handleClose();
            }}
            aria-label={routeActive ? 'Cancel route' : 'Close'}
          >
            {closeIcon}
          </button>
        </div>
      </div>

      {!routeActive && <div className="route-planning-sheet__body">
        <>
            <AddressField
              label="From"
              query={startQuery}
              setQuery={setStartQuery}
              coords={startCoords}
              setCoords={setStartCoords}
              placeholder="Start location"
            />
            <AddressField
              label="To"
              query={endQuery}
              setQuery={setEndQuery}
              coords={endCoords}
              setCoords={setEndCoords}
              placeholder="Destination"
            />

            <div className="route-sheet__mode-row">
              <button
                className={`route-sheet__mode-btn${travelMode === 'car' ? ' route-sheet__mode-btn--active' : ''}`}
                onClick={() => setTravelMode('car')}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="1" y="11" width="22" height="8" rx="2" ry="2"/>
                  <path d="M5 11V7a7 7 0 0 1 14 0v4"/>
                  <circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>
                </svg>
                Drive
              </button>
              <button
                className={`route-sheet__mode-btn${travelMode === 'foot' ? ' route-sheet__mode-btn--active' : ''}`}
                onClick={() => setTravelMode('foot')}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="4" r="1.5"/>
                  <path d="M9 8l-2 5h5l1 5"/>
                  <path d="M13 8l2 3-2 2"/>
                  <path d="M7 13l-2 5"/>
                </svg>
                Walk
              </button>
              <button
                className={`route-sheet__mode-btn${travelMode === 'bike' ? ' route-sheet__mode-btn--active' : ''}`}
                onClick={() => setTravelMode('bike')}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
                  <path d="M15 6a1 1 0 0 0-1-1h-2"/>
                  <path d="M15 6l-3 8H5.5"/>
                  <path d="M15 6l3.5 5.5"/>
                  <path d="M18.5 11.5L18.5 17.5"/>
                </svg>
                Bike
              </button>
            </div>

            <div className="route-sheet__preview">
              {previewLoading && (
                <span className="route-sheet__preview-status">Calculating route…</span>
              )}
              {!previewLoading && routePreview && (
                <>
                  <span className="route-sheet__preview-distance">
                    {formatDistance(routePreview.distance)}
                  </span>
                  <span className="route-sheet__preview-duration">
                    {formatDuration(routePreview.duration)}
                  </span>
                </>
              )}
              {!previewLoading && previewError && (
                <span className="route-sheet__preview-status route-sheet__preview-status--error">
                  No route found
                </span>
              )}
            </div>

            {routePreview && (
              <ElevationChart
                elevations={elevationProfile}
                loading={elevationLoading}
                error={elevationError}
              />
            )}

            <button
              className="route-sheet__confirm-btn"
              disabled={!startCoords || !endCoords}
              onClick={handleConfirm}
            >
              Get Directions
            </button>
          </>
      </div>}
    </Sheet>
  );
}
