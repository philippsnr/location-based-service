import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sheet } from 'framework7-react';

const PEEK_HEIGHT = 140;
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

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

function WeatherStrip({ weatherInfo }) {
  const descText = weatherInfo.description.split(' ').slice(0, -1).join(' ');
  return (
    <div className="lis-weather">
      <span className="lis-weather__icon">{weatherInfo.icon}</span>
      <span className="lis-weather__temp">{Math.round(weatherInfo.temperature)}°</span>
      <span className="lis-weather__desc">{descText}</span>
      <span className="lis-weather__wind">💨 {Math.round(weatherInfo.windSpeed)} km/h</span>
    </div>
  );
}

function LocationInfoSheet({ opened, onClosed, locationInfo, loading, onShowRoute, routingActive, routeInfo }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
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

  const getOsmUrl = useCallback((lat, lng) => {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  }, []);

  const handleShare = useCallback(async () => {
    if (!locationInfo?.lat || !locationInfo?.lng) return;

    const title = locationInfo.placeName || 'Selected location';
    const url = getOsmUrl(locationInfo.lat, locationInfo.lng);

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setShareMessage('Shared successfully.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${title} - ${url}`);
        setShareMessage('Link copied to clipboard.');
      } else {
        window.prompt('Copy this location URL', url);
        setShareMessage('Use the prompt to copy the link.');
      }
    } catch (err) {
      console.warn('Share failed:', err);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(`${title} - ${url}`);
          setShareMessage('Link copied to clipboard.');
          return;
        } catch (copyError) {
          console.warn('Clipboard fallback failed:', copyError);
        }
      }
      setShareMessage('Unable to share location.');
    }
  }, [getOsmUrl, locationInfo]);

  useEffect(() => {
    if (!shareMessage) return;
    const t = window.setTimeout(() => setShareMessage(''), 3000);
    return () => window.clearTimeout(t);
  }, [shareMessage]);

  const lat = locationInfo?.lat;
  const lng = locationInfo?.lng;
  const latLabel = lat != null ? `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}` : null;
  const lngLabel = lng != null ? `${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}` : null;

  const canShare = !loading && locationInfo?.lat != null;

  return (
    <Sheet
      className={`location-info-sheet${isExpanded ? ' location-info-sheet--expanded' : ''}`}
      opened={opened}
      onSheetClosed={handleClose}
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
    >
      {/* Drag zone: handle + title + icon actions */}
      <div
        className="sheet-modal-swipe-step"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <div className="location-info-sheet__handle" />

        <div className="location-info-sheet__header">
          <div className="location-info-sheet__place-name">
            {loading ? 'Loading…' : locationInfo?.placeName ?? 'Unknown location'}
          </div>
          <button
            className="location-info-sheet__close-btn"
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Icon action row — visible in both peek and expanded state */}
        <div className="lis-icon-row" onClick={(e) => e.stopPropagation()}>
          <button
            className="lis-icon-btn"
            disabled={loading || routingActive}
            aria-label="Get Directions"
            onClick={() => {
              const sheetEl = sheetElRef.current ?? document.querySelector('.location-info-sheet');
              if (sheetEl) {
                sheetElRef.current = sheetEl;
                snapTo(sheetEl, PEEK_HEIGHT, () => { flushSync(() => applyExpanded(false)); });
              }
              onShowRoute();
            }}
          >
            <span className="lis-icon-btn__circle">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <polygon points="12,2 22,22 12,17 2,22" />
              </svg>
            </span>
            <span className="lis-icon-btn__label">{routingActive ? 'Active' : 'Directions'}</span>
          </button>

          <button
            className="lis-icon-btn"
            disabled={!canShare}
            aria-label="Share location"
            onClick={handleShare}
          >
            <span className="lis-icon-btn__circle">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </span>
            <span className="lis-icon-btn__label">Share</span>
          </button>
        </div>

        {shareMessage && (
          <div className="lis-share-msg">{shareMessage}</div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="location-info-sheet__scroll">

        {/* Hero image */}
        {!loading && locationInfo?.wikiThumbnail && (
          <img
            src={locationInfo.wikiThumbnail}
            alt={locationInfo.placeName}
            className="lis-hero"
          />
        )}

        {/* Weather */}
        {loading ? (
          <div className="lis-weather lis-weather--loading">Loading weather…</div>
        ) : locationInfo?.weatherInfo ? (
          <WeatherStrip weatherInfo={locationInfo.weatherInfo} />
        ) : null}

        {/* Route summary */}
        {routeInfo && (
          <div className="lis-route-summary">
            <span className="lis-route-summary__distance">{formatDistance(routeInfo.distance)}</span>
            <span className="lis-route-summary__sep">·</span>
            <span className="lis-route-summary__duration">{formatDuration(routeInfo.duration)}</span>
          </div>
        )}

        {/* Coordinates + Wikipedia */}
        <div className="lis-details">
          {loading ? (
            <p className="lis-details__loading">Fetching information…</p>
          ) : (
            <>
              {(latLabel || lngLabel) && (
                <div className="lis-coords">
                  {latLabel && <span className="lis-coords__chip">{latLabel}</span>}
                  {lngLabel && <span className="lis-coords__chip">{lngLabel}</span>}
                </div>
              )}
              {locationInfo?.wikiSummary && (
                <div className="lis-wiki">
                  <p className="lis-wiki__text">{locationInfo.wikiSummary}</p>
                  {locationInfo.wikiUrl && (
                    <a
                      href={locationInfo.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lis-wiki__link"
                    >
                      Read more on Wikipedia
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export default LocationInfoSheet;
