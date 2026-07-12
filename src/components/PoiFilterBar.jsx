import { POI_FILTERS } from '../services/overpass';

/**
 * @file Horizontal toolbar of POI category toggle buttons (restaurants, cafés,
 * etc.). The active button reflects loading/error state for its category.
 */

const ICONS = {
  restaurant: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
    </svg>
  ),
  cafe: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
    </svg>
  ),
  supermarket: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  ),
  pharmacy: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M21 5h-2.64l1.14-3.14L17.15 1l-1.46 4H3v2l2 6-2 6v2h18v-2l-2-6 2-6V5zm-5 9h-3v3h-2v-3H8v-2h3V9h2v3h3v2z" />
    </svg>
  ),
  atm: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
      <path d="M6 15h4v2H6zm6 0h2v2h-2zm4 0h2v2h-2z" />
    </svg>
  ),
  bar: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z" />
    </svg>
  ),
  hotel: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z" />
    </svg>
  ),
  museum: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 3 2 9v2h20V9L12 3zm-7 9v7H3v2h18v-2h-2v-7h-2v7h-3v-7h-2v7h-2v-7H8v7H7v-7H5z" />
    </svg>
  ),
  bus_stop: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
    </svg>
  ),
  train_station: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm5.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-7h-5V6h5v4z" />
    </svg>
  ),
  spinner: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className="poi-spinner"
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * @typedef {Object} PoiFilterBarProps
 * @property {string|null} activeFilter - Id of the currently selected filter, or null.
 * @property {boolean} loading - Whether a POI fetch is in progress (shown on the active button).
 * @property {boolean} error - Whether the last fetch failed (shown on the active button).
 * @property {(filterId: string) => void} onToggle - Fires with a filter id when a button is tapped.
 */

/**
 * Toolbar of POI category filter buttons built from {@link POI_FILTERS}.
 * @param {PoiFilterBarProps} props
 * @returns {import('react').ReactElement}
 */
function PoiFilterBar({ activeFilter, loading, error, onToggle }) {
  return (
    <div className="poi-filter-bar" role="toolbar" aria-label="Nearby places filters">
      {POI_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        const isLoading = loading && isActive;
        const hasError = error && isActive;
        return (
          <button
            key={filter.id}
            className={`poi-filter-btn${isActive ? ' poi-filter-btn--active' : ''}${isLoading ? ' poi-filter-btn--loading' : ''}${hasError ? ' poi-filter-btn--error' : ''}`}
            onClick={() => onToggle(filter.id)}
            aria-pressed={isActive}
            aria-busy={isLoading}
          >
            <span className="poi-filter-btn__icon">
              {isLoading ? ICONS.spinner : ICONS[filter.id]}
            </span>
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

export default PoiFilterBar;
