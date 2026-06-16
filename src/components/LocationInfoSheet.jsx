import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sheet } from 'framework7-react';

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

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

const POI_TYPE_LABEL = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  supermarket: 'Supermarket',
  pharmacy: 'Pharmacy',
  atm: 'ATM',
  bar: 'Bar',
  hotel: 'Hotel',
  museum: 'Museum',
  bus_stop: 'Bus Stop',
  train_station: 'Train Station',
};

const WHEELCHAIR_LABEL = {
  yes: 'Wheelchair accessible',
  limited: 'Limited wheelchair access',
  no: 'Not wheelchair accessible',
};

function formatWebsiteLabel(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

// Horizontal photo carousel with pagination dots. The dots hint that more
// photos exist and track which one is in view (active dot expands to a pill).
function PhotoCarousel({ photos, placeName }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef(null);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="lis-carousel">
      <div className="lis-carousel__track" ref={trackRef} onScroll={handleScroll}>
        {photos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${placeName ?? 'Location'} photo ${i + 1}`}
            className="lis-carousel__img"
          />
        ))}
      </div>
      <div className="lis-carousel__dots" aria-hidden="true">
        {photos.map((src, i) => (
          <span
            key={src}
            className={`lis-carousel__dot${i === active ? ' lis-carousel__dot--active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function PoiInfoSection({ poi }) {
  const typeLabel = POI_TYPE_LABEL[poi.type] ?? poi.type;
  const cuisine = poi.cuisine ? poi.cuisine.split(/[;,]/)[0].trim() : null;

  return (
    <div className="lis-poi">
      <span className="lis-poi__type">{typeLabel}</span>

      {poi.address && (
        <div className="lis-poi__row">
          <svg className="lis-poi__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span>{poi.address}</span>
        </div>
      )}

      {poi.openingHours && (
        <div className="lis-poi__row">
          <svg className="lis-poi__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
          </svg>
          <span>{poi.openingHours}</span>
        </div>
      )}

      {cuisine && (
        <div className="lis-poi__row">
          <svg className="lis-poi__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
          </svg>
          <span style={{ textTransform: 'capitalize' }}>{cuisine}</span>
        </div>
      )}

      {poi.website && (
        <div className="lis-poi__row">
          <svg className="lis-poi__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <a href={poi.website} target="_blank" rel="noopener noreferrer" className="lis-poi__link">
            {formatWebsiteLabel(poi.website)}
          </a>
        </div>
      )}

      {poi.phone && (
        <div className="lis-poi__row">
          <svg className="lis-poi__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
          <a href={`tel:${poi.phone}`} className="lis-poi__link">{poi.phone}</a>
        </div>
      )}

      {poi.operator && (
        <div className="lis-poi__row">
          <svg className="lis-poi__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
          </svg>
          <span>{poi.operator}</span>
        </div>
      )}

      {poi.wheelchair && (
        <div className="lis-poi__row">
          <svg className="lis-poi__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 4c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-1.95 9H14v6h2v-6.28c0-1.06-.84-1.93-1.91-1.96l-1.57-.04L11 8.4l3.46 2.07.99-1.71-3.95-2.35a1.991 1.991 0 0 0-2.6.45L7.34 9.45l-3.6 1.04.55 1.93 4.18-1.21 1.06-1.27L10.5 14H7v6h2v-4.51l3.05-1.49z"/>
          </svg>
          <span>{WHEELCHAIR_LABEL[poi.wheelchair] ?? `Wheelchair: ${poi.wheelchair}`}</span>
        </div>
      )}
    </div>
  );
}

function formatFounded(year) {
  return year < 0 ? `${Math.abs(year)} BC` : `${year}`;
}

// Structured city facts from Wikidata. Each row is rendered only when the
// corresponding field has data; the whole section is hidden when empty.
function FactsSection({ facts }) {
  const rows = [
    facts.population != null && {
      key: 'population',
      icon: '👥',
      label: 'Population',
      value: facts.population.toLocaleString(),
    },
    facts.area != null && {
      key: 'area',
      icon: '📐',
      label: 'Area',
      value: `${facts.area.toLocaleString(undefined, { maximumFractionDigits: 1 })} km²`,
    },
    facts.founded != null && {
      key: 'founded',
      icon: '📅',
      label: 'Founded',
      value: formatFounded(facts.founded),
    },
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <div className="lis-facts">
      {rows.map((row) => (
        <div key={row.key} className="lis-fact">
          <span className="lis-fact__icon" aria-hidden="true">{row.icon}</span>
          <span className="lis-fact__label">{row.label}</span>
          <span className="lis-fact__value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function uvIndexLabel(uv) {
  if (uv <= 2) return { text: 'low',      color: '#4caf50' };
  if (uv <= 5) return { text: 'moderate', color: '#ffc107' };
  if (uv <= 7) return { text: 'high',     color: '#ff9800' };
  return             { text: 'very high', color: '#f44336' };
}

// European Air Quality Index bands (label + dot colour).
function airQualityLabel(aqi) {
  if (aqi <= 20)  return { text: 'Good',           color: '#50ccb0' };
  if (aqi <= 50)  return { text: 'Fair',           color: '#a8c84a' };
  if (aqi <= 100) return { text: 'Moderate',       color: '#f0c020' };
  if (aqi <= 150) return { text: 'Poor',           color: '#ff9800' };
  if (aqi <= 200) return { text: 'Very Poor',      color: '#f44336' };
  return             { text: 'Extremely Poor', color: '#960032' };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function DaylightBar({ sunrise, sunset }) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const riseMin = toMinutes(sunrise);
  const setMin = toMinutes(sunset);
  const progress = Math.min(1, Math.max(0, (nowMin - riseMin) / (setMin - riseMin)));
  return (
    <div className="lis-daylight-row">
      <span className="lis-daylight-label">🌅 {sunrise}</span>
      <div className="lis-daylight-track">
        <div className="lis-daylight-fill" style={{ width: `${progress * 100}%` }} />
        <div className="lis-daylight-dot" style={{ left: `${progress * 100}%` }} />
      </div>
      <span className="lis-daylight-label">🌇 {sunset}</span>
    </div>
  );
}

function WeatherStrip({ weatherInfo }) {
  const descText = weatherInfo.description.split(' ').slice(0, -1).join(' ');
  const { sunrise, sunset, humidity, uvIndex, apparentTemperature, airQuality } = weatherInfo;
  const temp = Math.round(weatherInfo.temperature);
  // Show "feels like" whenever the rounded value differs from the actual temp.
  const feelsLike = apparentTemperature != null ? Math.round(apparentTemperature) : null;
  const showFeelsLike = feelsLike != null && feelsLike !== temp;
  return (
    <div className="lis-weather-block">
      <div className="lis-weather-row">
        <span className="lis-weather-icon">{weatherInfo.icon}</span>
        <div className="lis-weather-body">
          <div className="lis-weather-top">
            <span className="lis-weather-temp">{temp}°</span>
            {showFeelsLike && (
              <span className="lis-weather-feels">· feels like {feelsLike}°</span>
            )}
            <span className="lis-weather-desc">{descText}</span>
          </div>
          <div className="lis-weather-meta">
            <span className="lis-weather-meta__item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2"/>
                <path d="M12.73 19.41A2 2 0 1 0 14 16H2"/>
                <path d="M16.27 7.73A2.5 2.5 0 1 1 18.5 12H2"/>
              </svg>
              {Math.round(weatherInfo.windSpeed)} km/h
            </span>
            {humidity != null && (
              <span className="lis-weather-meta__item">
                💧 {humidity}%
              </span>
            )}
            {uvIndex != null && (() => {
              const { text, color } = uvIndexLabel(uvIndex);
              return (
                <span className="lis-weather-meta__item" style={{ color }}>
                  UV {uvIndex} <span style={{ fontSize: '0.75em', opacity: 0.85 }}>{text}</span>
                </span>
              );
            })()}
          </div>
        </div>
      </div>
      {airQuality?.aqi != null && (() => {
        const { text, color } = airQualityLabel(airQuality.aqi);
        return (
          <div className="lis-aqi-row">
            <span className="lis-aqi-dot" style={{ background: color }} aria-hidden="true" />
            <span className="lis-aqi-label">AQI {text}</span>
            <span className="lis-aqi-value">{airQuality.aqi}</span>
          </div>
        );
      })()}
      {sunrise && sunset && <DaylightBar sunrise={sunrise} sunset={sunset} />}
    </div>
  );
}

function LocationInfoSheet({ opened, onClosed, locationInfo, loading, onShowRoute, routingActive, routeInfo, distanceToUser, isFavourite, onToggleFavourite, initialCollapsed = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [coordsCopied, setCoordsCopied] = useState(false);
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
    applyExpanded(!initialCollapsed);
  }, [opened, locationInfo?.lat, locationInfo?.lng, applyExpanded, initialCollapsed]);

  const handleShare = useCallback(async () => {
    if (!locationInfo?.lat || !locationInfo?.lng) return;
    const title = locationInfo.placeName || 'Selected location';
    const url = `https://philippsnr.github.io/location-based-service/?lat=${locationInfo.lat}&lng=${locationInfo.lng}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareMessage('Link copied to clipboard.');
      } else {
        window.prompt('Copy this location URL', url);
      }
    } catch (err) {
      console.warn('Share failed:', err);
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          setShareMessage('Link copied to clipboard.');
        } catch {
          setShareMessage('Unable to share location.');
        }
      }
    }
  }, [locationInfo]);

  useEffect(() => {
    if (!shareMessage) return;
    const t = window.setTimeout(() => setShareMessage(''), 3000);
    return () => window.clearTimeout(t);
  }, [shareMessage]);

  const handleCopyCoords = useCallback(async () => {
    const { lat: la, lng: lo } = locationInfo ?? {};
    if (la == null || lo == null) return;
    const text = `${la.toFixed(6)}, ${lo.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy coordinates', text);
    }
    setCoordsCopied(true);
    setTimeout(() => setCoordsCopied(false), 2000);
  }, [locationInfo]);

  const lat = locationInfo?.lat;
  const lng = locationInfo?.lng;
  const latLabel = lat != null ? `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}` : null;
  const lngLabel = lng != null ? `${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}` : null;
  const canShare = !loading && lat != null;

  return (
    <Sheet
      className={`location-info-sheet${isExpanded ? ' location-info-sheet--expanded' : ''}`}
      opened={opened}
      onSheetClosed={handleClose}
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
    >
      {/* Fixed header */}
      <div
        className="sheet-modal-swipe-step"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <div className="location-info-sheet__handle" />
        <div className="location-info-sheet__header">
          <div className="location-info-sheet__title-group">
            <div className="location-info-sheet__place-name">
              {loading ? (
                <span className="lis-skeleton lis-skeleton--title" aria-label="Loading" />
              ) : (
                locationInfo?.placeName ?? 'Unknown location'
              )}
            </div>
            {!loading && !locationInfo?.poi && locationInfo?.address &&
              locationInfo.address !== locationInfo.placeName && (
              <div className="location-info-sheet__address">
                {locationInfo.address}
              </div>
            )}
            {!loading && locationInfo?.country && (
              <div className="location-info-sheet__country">
                {locationInfo.countryCode
                  ? String.fromCodePoint(
                      ...locationInfo.countryCode.toUpperCase().split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
                    ) + ' '
                  : ''}
                {locationInfo.country}
              </div>
            )}
          </div>

          <button
            className={`lis-fav-btn${isFavourite ? ' lis-fav-btn--active' : ''}`}
            disabled={loading || locationInfo?.lat == null}
            aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={!!isFavourite}
            title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            onClick={(e) => { e.stopPropagation(); onToggleFavourite?.(); }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill={isFavourite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>

          <button
            className="lis-action-btn"
            disabled={loading || routingActive}
            aria-label="Get directions"
            title="Get directions"
            onClick={(e) => {
              e.stopPropagation();
              const sheetEl = sheetElRef.current ?? document.querySelector('.location-info-sheet');
              if (sheetEl) {
                sheetElRef.current = sheetEl;
                snapTo(sheetEl, PEEK_HEIGHT, () => { flushSync(() => applyExpanded(false)); });
              }
              onShowRoute();
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <polygon points="12,2 22,22 12,17 2,22" />
            </svg>
          </button>

          <button
            className="lis-action-btn"
            disabled={!canShare}
            aria-label="Share location"
            title="Share location"
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>

          <button
            className="location-info-sheet__close-btn"
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

      {/* Scrollable body */}
      <div className="location-info-sheet__scroll">

        {shareMessage && (
          <div className="lis-toast">{shareMessage}</div>
        )}

        {loading ? (
          <div className="lis-skeleton lis-skeleton--hero" />
        ) : !locationInfo?.poi && locationInfo?.wikiPhotos?.length > 0 ? (
          locationInfo.wikiPhotos.length === 1 ? (
            <img
              src={locationInfo.wikiPhotos[0]}
              alt={locationInfo.placeName ?? ''}
              className="lis-hero"
            />
          ) : (
            <PhotoCarousel
              photos={locationInfo.wikiPhotos}
              placeName={locationInfo.placeName}
            />
          )
        ) : null}

        {loading ? (
          <div className="lis-skeleton-weather">
            <div className="lis-skeleton lis-skeleton--weather" />
          </div>
        ) : locationInfo?.weatherInfo ? (
          <WeatherStrip weatherInfo={locationInfo.weatherInfo} />
        ) : null}

        {routeInfo && (
          <div className="lis-route-card">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="lis-route-card__distance">{formatDistance(routeInfo.distance)}</span>
            <span className="lis-route-card__sep">·</span>
            <span className="lis-route-card__duration">{formatDuration(routeInfo.duration)}</span>
          </div>
        )}

        {!loading && (latLabel || locationInfo?.elevation != null || distanceToUser != null) && (
          <div className="lis-stats">
            {latLabel && lngLabel && (
              <div className="lis-stat">
                <svg className="lis-stat__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <span className="lis-stat__value lis-stat__value--mono">{latLabel} · {lngLabel}</span>
                <button
                  className="lis-stat__copy"
                  onClick={(e) => { e.stopPropagation(); handleCopyCoords(); }}
                  aria-label="Copy coordinates"
                  title="Copy coordinates"
                >
                  {coordsCopied ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
            )}
            {locationInfo?.elevation != null && (
              <div className="lis-stat">
                <svg className="lis-stat__icon" viewBox="0 0 20 14" fill="currentColor" aria-hidden="true">
                  <path d="M0 14 L7 2 L11 8 L14 4 L20 14 Z" />
                </svg>
                <span className="lis-stat__value">{locationInfo.elevation} m above sea level</span>
              </div>
            )}
            {distanceToUser != null && (
              <div className="lis-stat">
                <svg className="lis-stat__icon" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <circle cx="2" cy="2" r="1.8" />
                  <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.5 2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="1.8" />
                </svg>
                <span className="lis-stat__value">{formatDistance(distanceToUser)} from your location</span>
              </div>
            )}
            {locationInfo?.weatherInfo?.timezone && (
              <div className="lis-stat">
                <svg className="lis-stat__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <span className="lis-stat__value">
                  {new Intl.DateTimeFormat('en-GB', { timeZone: locationInfo.weatherInfo.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date())}
                  {' · '}
                  {locationInfo.weatherInfo.timezone}
                </span>
              </div>
            )}
          </div>
        )}

        {!loading && !locationInfo?.poi && locationInfo?.facts && (
          <FactsSection facts={locationInfo.facts} />
        )}

        {loading ? (
          <div className="lis-content lis-skeleton-text" aria-label="Fetching information">
            <div className="lis-skeleton lis-skeleton--line" />
            <div className="lis-skeleton lis-skeleton--line" />
            <div className="lis-skeleton lis-skeleton--line lis-skeleton--line-short" />
          </div>
        ) : locationInfo?.poi ? (
          <div className="lis-content">
            <PoiInfoSection poi={locationInfo.poi} />
          </div>
        ) : locationInfo?.wikiSummary ? (
          <div className="lis-content">
            <p className="lis-wiki-text">{locationInfo.wikiSummary}</p>
            {locationInfo.wikiUrl && (
              <a
                href={locationInfo.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="lis-wiki-link"
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
        ) : null}

      </div>
    </Sheet>
  );
}

export default LocationInfoSheet;
