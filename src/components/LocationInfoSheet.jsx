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

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

function LocationInfoSheet({ opened, onClosed, locationInfo, loading, onShowRoute, routingActive, routeInfo }) {
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
        <div className="location-info-sheet__header-container">
          <div className="location-info-sheet__place-name">
            {loading ? 'Loading…' : locationInfo?.placeName ?? 'Unknown location'}
          </div>
          <button
            className="location-info-sheet__reset-btn"
            onClick={handleClose}
            aria-label="Close"
            title="Close"
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
      <div className="location-info-sheet__scroll">
        {loading ? (
          <div className="location-info-sheet__weather location-info-sheet__weather--loading">
            Weather loading…
          </div>
        ) : locationInfo?.weatherInfo ? (
          <div className="location-info-sheet__weather">
            <span className="location-info-sheet__weather-temp">{locationInfo.weatherInfo.temperature}°C</span>
            <span className="location-info-sheet__weather-desc">{locationInfo.weatherInfo.description}</span>
            <span className="location-info-sheet__weather-wind">💨 {locationInfo.weatherInfo.windSpeed} km/h</span>
          </div>
        ) : null}
        {!loading && locationInfo?.wikiThumbnail && (
          <img
            src={locationInfo.wikiThumbnail}
            alt={locationInfo.placeName}
            className="location-info-sheet__thumb"
          />
        )}
        <Block>
          <button
            onClick={() => {
              const sheetEl = sheetElRef.current ?? document.querySelector('.location-info-sheet');
              if (sheetEl) {
                sheetElRef.current = sheetEl;
                snapTo(sheetEl, PEEK_HEIGHT, () => {
                  flushSync(() => applyExpanded(false));
                });
              }
              onShowRoute();
            }}
            disabled={loading || routingActive}
            className="location-info-sheet__route-btn"
            style={{
              background: routingActive ? '#aaa' : '#007aff',
              cursor: routingActive ? 'default' : 'pointer',
            }}
          >
            {routingActive ? 'Route active' : 'Show route'}
          </button>
          {routeInfo && (
            <div className="location-info-sheet__route-info">
              <span><strong>Distance:</strong> {formatDistance(routeInfo.distance)}</span>
              <span><strong>Duration:</strong> {formatDuration(routeInfo.duration)}</span>
            </div>
          )}
        </Block>
        <Block>
          {loading ? (
            <p>Fetching information…</p>
          ) : (
            <>
              <div className="location-info-sheet__coords">
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
