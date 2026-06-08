import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sheet } from 'framework7-react';
import L from 'leaflet';
import { forwardGeocode } from '../services/nominatim';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;
const PEEK_HEIGHT = 80;
const DRAG_THRESHOLD = 20;
const SNAP_THRESHOLD = 50;
const SNAP_DURATION = 300;

function getFullHeight() {
  return Math.min(520, Math.round(window.innerHeight * 0.8));
}

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

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

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
};

async function fetchRoutePreview(start, end, profile, signal) {
  const base = OSRM_BASE[profile] ?? OSRM_BASE.car;
  const url = `${base}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  return data.routes?.[0]
    ? { distance: data.routes[0].distance, duration: data.routes[0].duration }
    : null;
}

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
                <div className="route-sheet__result-name">{r.name}</div>
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
      return;
    }

    const ctrl = new AbortController();
    setPreviewLoading(true);
    setRoutePreview(null);
    setPreviewError(false);

    fetchRoutePreview(startCoords, endCoords, travelMode, ctrl.signal)
      .then((preview) => {
        if (!ctrl.signal.aborted) {
          setRoutePreview(preview);
          if (!preview) setPreviewError(true);
          setPreviewLoading(false);
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
      className={`route-planning-sheet${isExpanded ? ' route-planning-sheet--expanded' : ''}`}
      opened={opened}
      onSheetClosed={handleClose}
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
    >
      <div
        className="route-planning-sheet__header sheet-modal-swipe-step"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <div className="location-info-sheet__handle" />
        <div className="route-planning-sheet__title-row">
          <span className="route-planning-sheet__title">
            {routeActive ? 'Active Route' : 'Plan Route'}
          </span>
          {routeActive && !isExpanded && routePreview && (
            <span className="route-sheet__active-summary">
              {formatDistance(routePreview.distance)} · {formatDuration(routePreview.duration)}
            </span>
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

      <div className="route-planning-sheet__body">
        {routeActive ? (
          <>
            {routePreview && (
              <div className="route-sheet__preview">
                <span className="route-sheet__preview-distance">
                  {formatDistance(routePreview.distance)}
                </span>
                <span className="route-sheet__preview-duration">
                  {formatDuration(routePreview.duration)}
                </span>
              </div>
            )}
            <button
              className="route-sheet__cancel-btn"
              onClick={handleCancelRoute}
            >
              Cancel Route
            </button>
          </>
        ) : (
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
                Drive
              </button>
              <button
                className={`route-sheet__mode-btn${travelMode === 'foot' ? ' route-sheet__mode-btn--active' : ''}`}
                onClick={() => setTravelMode('foot')}
              >
                Walk
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

            <button
              className="route-sheet__confirm-btn"
              disabled={!startCoords || !endCoords}
              onClick={handleConfirm}
            >
              Get Directions
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
