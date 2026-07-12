import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import HistoryIcon from '@mui/icons-material/History';
import { forwardGeocode } from '../services/nominatim';

/**
 * @file Map search box with debounced forward-geocoding autocomplete. Guards
 * against stale responses and stops Leaflet from treating clicks/scrolls in the
 * control as map interactions.
 */

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;
const HISTORY_KEY = 'search-history';
const HISTORY_MAX = 5;

function readHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToHistory(item) {
  const history = readHistory().filter(
    (h) => !(Math.abs(h.lat - item.lat) < 1e-5 && Math.abs(h.lng - item.lng) < 1e-5),
  );
  history.unshift({ name: item.name, lat: item.lat, lng: item.lng, type: item.type });
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  } catch {
    // ignore
  }
}

/**
 * @typedef {Object} SearchControlProps
 * @property {(place: {lat: number, lng: number, name: string, type: string}) => void} onSelect - Fires with the chosen place when a result is selected.
 */

/**
 * Search box that autocompletes place names via {@link forwardGeocode} and
 * reports the selected place to the parent.
 * @param {SearchControlProps} props
 * @returns {import('react').ReactElement}
 */
export default function SearchControl({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState(() => readHistory());
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  // Stop Leaflet from interpreting clicks/wheels in the search container
  // as map interactions. Without this, typing or scrolling the dropdown
  // would drop a marker on the map below.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  // Close dropdown when clicking anywhere outside.
  useEffect(() => {
    const onDocPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, []);

  // Debounced search. AbortController cancels the in-flight request when
  // the user types again, so a slow earlier response can't overwrite a
  // newer one (race-condition guard).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    const handle = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const items = await forwardGeocode(trimmed, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResults(items);
          setOpen(true);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Forward geocoding failed:', err);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  const handleSelect = (item) => {
    if (abortRef.current) abortRef.current.abort();
    saveToHistory(item);
    setHistory(readHistory());
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect({ lat: item.lat, lng: item.lng, name: item.name, type: item.type });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    if (abortRef.current) abortRef.current.abort();
  };

  const showHistory = open && query.trim().length < MIN_QUERY_LENGTH && history.length > 0;
  const showResults =
    open && query.trim().length >= MIN_QUERY_LENGTH && (loading || results.length > 0);

  return (
    <div className="search-control" ref={containerRef}>
      <div className="search-control__input-wrap">
        <input
          type="text"
          className="search-control__input"
          placeholder="Search for a place…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length < MIN_QUERY_LENGTH) {
              if (history.length > 0) setOpen(true);
            } else if (results.length > 0 || loading) {
              setOpen(true);
            }
          }}
          aria-label="Search for a place"
        />
        {query && (
          <button
            type="button"
            className="search-control__clear"
            onClick={handleClear}
            aria-label="Clear search"
            title="Clear"
          >
            ×
          </button>
        )}
      </div>
      {showHistory && (
        <ul className="search-control__results" role="listbox">
          <li className="search-control__status search-control__status--label">Recent searches</li>
          {history.map((h, idx) => (
            <li
              key={`${h.lat},${h.lng},${idx}`}
              className="search-control__item search-control__item--history"
              role="option"
              onClick={() => handleSelect(h)}
            >
              <div className="search-control__item-name">
                <HistoryIcon
                  className="search-control__history-icon"
                  sx={{ fontSize: 14, color: '#999', mr: '8px', flexShrink: 0 }}
                />
                <span className="search-control__item-name-text">{h.name}</span>
                {h.type && <span className="place-type-badge">{h.type}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {showResults && (
        <ul className="search-control__results" role="listbox">
          {loading && <li className="search-control__status">Searching…</li>}
          {!loading && results.length === 0 && (
            <li className="search-control__status">No results</li>
          )}
          {!loading &&
            results.map((r, idx) => (
              <li
                key={`${r.lat},${r.lng},${idx}`}
                className="search-control__item"
                role="option"
                onClick={() => handleSelect(r)}
              >
                <div className="search-control__item-name">
                  <span className="search-control__item-name-text">{r.name}</span>
                  {r.type && <span className="place-type-badge">{r.type}</span>}
                </div>
                {r.country && <div className="search-control__item-country">{r.country}</div>}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
