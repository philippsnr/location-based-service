import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sheet, Block, Link } from 'framework7-react';

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

function LocationInfoSheet({ opened, onClosed, locationInfo, loading }) {
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

      const totalDrag = startY - ev.clientY; // positive = dragged up
      if (Math.abs(totalDrag) > DRAG_THRESHOLD) dragRef.current.dragged = true;

      const fullH = getFullHeight();
      let shouldExpand;
      if (Math.abs(totalDrag) > SNAP_THRESHOLD) {
        shouldExpand = totalDrag > 0;
      } else {
        shouldExpand = isExpandedRef.current; // not enough drag → stay in current state
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

  return (
    <Sheet
      className={`location-info-sheet${isExpanded ? ' location-info-sheet--expanded' : ''}`}
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
        <div className="location-info-sheet__handle" />
        <div className="location-info-sheet__place-name">
          {loading ? 'Loading…' : locationInfo?.placeName ?? 'Unknown location'}
        </div>
      </div>
      <div className="location-info-sheet__scroll">
        {!loading && locationInfo?.wikiThumbnail && (
          <img
            src={locationInfo.wikiThumbnail}
            alt={locationInfo.placeName}
            style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
          />
        )}
        <Block>
          {loading ? (
            <p>Fetching information…</p>
          ) : (
            <>
              <div style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
                <div><strong>Latitude:</strong> {locationInfo?.lat?.toFixed(6)}</div>
                <div><strong>Longitude:</strong> {locationInfo?.lng?.toFixed(6)}</div>
              </div>
              {locationInfo?.wikiSummary ? (
                <>
                  <p>{locationInfo.wikiSummary}</p>
                  {locationInfo.wikiUrl && (
                    <Link external href={locationInfo.wikiUrl} target="_blank">
                      Read more on Wikipedia
                    </Link>
                  )}
                </>
              ) : (
                <p>No Wikipedia information found for this location.</p>
              )}
            </>
          )}
        </Block>
      </div>
    </Sheet>
  );
}

export default LocationInfoSheet;
