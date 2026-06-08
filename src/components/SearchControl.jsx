import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { forwardGeocode } from '../services/nominatim';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

export default function SearchControl({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
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
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect({ lat: item.lat, lng: item.lng, name: item.name });
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    if (abortRef.current) abortRef.current.abort();
  };

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
            if (results.length > 0 || loading) setOpen(true);
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
      {open && (loading || results.length > 0) && (
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
                <div className="search-control__item-name">{r.name}</div>
                {r.country && (
                  <div className="search-control__item-country">{r.country}</div>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}