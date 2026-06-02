import { useCallback, useRef, useState } from 'react';
import { Sheet, Block, Link } from 'framework7-react';

const DRAG_THRESHOLD = 40;

function LocationInfoSheet({ opened, onClosed, locationInfo, loading }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dragRef = useRef({ dragged: false });

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    onClosed();
  }, [onClosed]);

  const handlePointerDown = (e) => {
    const startY = e.clientY;
    dragRef.current.dragged = false;

    const onUp = (upEvent) => {
      document.removeEventListener('pointerup', onUp);
      const dy = startY - upEvent.clientY;
      if (Math.abs(dy) > DRAG_THRESHOLD) {
        dragRef.current.dragged = true;
        setIsExpanded(dy > 0);
      }
    };
    document.addEventListener('pointerup', onUp);
  };

  const handleClick = useCallback(() => {
    if (dragRef.current.dragged) {
      dragRef.current.dragged = false;
      return;
    }
    setIsExpanded(prev => !prev);
  }, []);

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
