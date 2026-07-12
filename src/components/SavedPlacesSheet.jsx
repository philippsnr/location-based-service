import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sheet } from 'framework7-react';
import L from 'leaflet';

/**
 * @file Bottom sheet listing the user's saved (favourite) places, newest first,
 * each with distance from the user and a remove button. Owns its own
 * peek/expand drag interaction.
 */

const PEEK_HEIGHT = 80;
const FULL_HEIGHT_RATIO = 0.67;
const DRAG_THRESHOLD = 20;
const SNAP_THRESHOLD = 50;
const SNAP_DURATION = 300;

/** @returns {number} Height in px for the "expanded" snap position. */
function getFullHeight() {
  return Math.round(window.innerHeight * FULL_HEIGHT_RATIO);
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

/**
 * @typedef {Object} SavedPlacesSheetProps
 * @property {boolean} opened - Whether the sheet should be visible.
 * @property {() => void} onClosed - Fires after the sheet closes.
 * @property {Array<{lat: number, lng: number, placeName: string, savedAt: string}>} favourites - Saved places to list.
 * @property {import('leaflet').LatLng | null} userPosition - Used to compute distance; hidden when null.
 * @property {(favourite: Object) => void} onSelect - Fires with a favourite when its row is tapped.
 * @property {(favourite: Object) => void} onRemove - Fires with a favourite when its remove button is tapped.
 */

/**
 * Bottom sheet listing saved favourite places, sorted newest-first. Supports
 * drag-to-expand/collapse and shows an empty-state hint when there are none.
 * @param {SavedPlacesSheetProps} props
 * @returns {import('react').ReactElement}
 */
function SavedPlacesSheet({ opened, onClosed, favourites, userPosition, onSelect, onRemove }) {
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
    applyExpanded(true);
  }, [opened, applyExpanded]);

  const sortedFavs = [...favourites].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  const title = favourites.length > 0
    ? `${favourites.length} saved place${favourites.length === 1 ? '' : 's'}`
    : 'Saved places';

  return (
    <Sheet
      className={`saved-places-sheet${isExpanded ? ' saved-places-sheet--expanded' : ''}`}
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
        <div className="saved-places-sheet__handle" />
        <div className="saved-places-sheet__header">
          <span className="saved-places-sheet__title">{title}</span>
          <button
            className="saved-places-sheet__close-btn"
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

      <div className="saved-places-sheet__scroll">
        {sortedFavs.length === 0 ? (
          <div className="saved-places-sheet__empty">
            No saved places yet. Tap the star on a location to save it here.
          </div>
        ) : (
          sortedFavs.map((fav) => {
            const dist = userPosition
              ? L.latLng(fav.lat, fav.lng).distanceTo(userPosition)
              : null;
            return (
              <div key={`${fav.lat},${fav.lng}`} className="saved-places-item">
                <button
                  type="button"
                  className="saved-places-item__main"
                  onClick={() => onSelect(fav)}
                >
                  <svg className="saved-places-item__icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="saved-places-item__name">{fav.placeName}</span>
                  {dist != null && (
                    <span className="saved-places-item__dist">{formatDistance(dist)}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="saved-places-item__remove"
                  onClick={(e) => { e.stopPropagation(); onRemove(fav); }}
                  aria-label={`Remove ${fav.placeName} from favourites`}
                  title="Remove"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

export default SavedPlacesSheet;
