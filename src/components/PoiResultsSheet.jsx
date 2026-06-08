import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sheet } from 'framework7-react';
import L from 'leaflet';
import { POI_FILTERS } from '../services/overpass';

const PEEK_HEIGHT = 80;
const FULL_HEIGHT_RATIO = 0.67;
const DRAG_THRESHOLD = 20;
const SNAP_THRESHOLD = 50;
const SNAP_DURATION = 300;

function getFullHeight() {
  return Math.round(window.innerHeight * FULL_HEIGHT_RATIO);
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

function PoiResultsSheet({ opened, onClosed, pois, userPosition, activeFilter, onSelectPoi }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const dragRef = useRef({ dragged: false });
  const sheetElRef = useRef(null);

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
    if (!opened) return;
    applyExpanded(false);
  }, [opened, applyExpanded]);

  const filterDef = POI_FILTERS.find(f => f.id === activeFilter);

  const sortedPois = [...pois].sort((a, b) => {
    if (userPosition) {
      const da = L.latLng(a.lat, a.lng).distanceTo(userPosition);
      const db = L.latLng(b.lat, b.lng).distanceTo(userPosition);
      return da - db;
    }
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  const title = filterDef
    ? `${pois.length} ${filterDef.label} nearby`
    : `${pois.length} results`;

  return (
    <Sheet
      className={`poi-results-sheet${isExpanded ? ' poi-results-sheet--expanded' : ''}`}
      opened={opened}
      onSheetClosed={handleClose}
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
    >
      <div
        className="sheet-modal-swipe-step"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <div className="poi-results-sheet__handle" />
        <div className="poi-results-sheet__header">
          <span className="poi-results-sheet__title">{title}</span>
          <button
            className="poi-results-sheet__close-btn"
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="poi-results-sheet__scroll">
        {sortedPois.map((poi) => {
          const dist = userPosition
            ? L.latLng(poi.lat, poi.lng).distanceTo(userPosition)
            : null;
          return (
            <button
              key={poi.id}
              className="poi-results-item"
              onClick={() => onSelectPoi(poi)}
            >
              <span
                className="poi-results-item__dot"
                style={{ background: filterDef?.color ?? '#888' }}
              />
              <span className="poi-results-item__name">{poi.name}</span>
              {dist != null && (
                <span className="poi-results-item__dist">{formatDistance(dist)}</span>
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export default PoiResultsSheet;
