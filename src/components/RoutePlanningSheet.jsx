import { useEffect, useRef, useState } from 'react';
import { Sheet } from 'framework7-react';
import L from 'leaflet';
import { forwardGeocode } from '../services/nominatim';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

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

async function fetchRoutePreview(start, end, profile, signal) {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}?overview=false`;
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
}) {
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
  };

  return (
    <Sheet
      className="route-planning-sheet"
      opened={opened}
      onSheetClosed={onClosed}
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
    >
      <div className="route-planning-sheet__header">
        <div className="location-info-sheet__handle" />
        <div className="route-planning-sheet__title-row">
          <span className="route-planning-sheet__title">Plan Route</span>
          <button
            className="location-info-sheet__reset-btn"
            onClick={onClosed}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              stroke="white"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="route-planning-sheet__body">
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
      </div>
    </Sheet>
  );
}
