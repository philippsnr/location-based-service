import { POI_FILTERS } from '../services/overpass';

const ICONS = {
  restaurant: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
    </svg>
  ),
  cafe: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
    </svg>
  ),
  supermarket: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
  ),
};

function PoiFilterBar({ activeFilter, loading, onToggle }) {
  return (
    <div className="poi-filter-bar" role="toolbar" aria-label="Nearby places filters">
      {POI_FILTERS.map(filter => {
        const isActive = activeFilter === filter.id;
        const isLoading = loading && isActive;
        return (
          <button
            key={filter.id}
            className={`poi-filter-btn${isActive ? ' poi-filter-btn--active' : ''}${isLoading ? ' poi-filter-btn--loading' : ''}`}
            onClick={() => onToggle(filter.id)}
            aria-pressed={isActive}
          >
            <span className="poi-filter-btn__icon">{ICONS[filter.id]}</span>
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

export default PoiFilterBar;
