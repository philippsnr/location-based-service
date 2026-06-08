import { POI_FILTERS } from '../services/overpass';

function PoiFilterBar({ activeFilter, loading, onToggle }) {
  return (
    <div className="poi-filter-bar" role="toolbar" aria-label="Nearby places filters">
      {POI_FILTERS.map(filter => {
        const isActive = activeFilter === filter.id;
        const isLoading = loading && isActive;
        return (
          <button
            key={filter.id}
            className={`poi-filter-btn${isActive ? ' poi-filter-btn--active' : ''}`}
            style={isActive ? { background: filter.color } : undefined}
            onClick={() => onToggle(filter.id)}
            aria-pressed={isActive}
          >
            <span className="poi-filter-btn__emoji" aria-hidden="true">
              {isLoading ? '⏳' : filter.emoji}
            </span>
            <span className="poi-filter-btn__label">{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default PoiFilterBar;
