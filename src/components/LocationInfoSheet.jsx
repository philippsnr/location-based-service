import { useCallback, useState } from 'react';
import { Sheet, Block, Link } from 'framework7-react';

function LocationInfoSheet({ opened, onClosed, locationInfo, loading }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    onClosed();
  }, [onClosed]);

  return (
    <Sheet
      className={`location-info-sheet${isExpanded ? ' location-info-sheet--expanded' : ''}`}
      opened={opened}
      onSheetClosed={handleClose}
      swipeToClose
      swipeHandler=".sheet-modal-swipe-step"
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
    >
      <div
        className="sheet-modal-swipe-step"
        onClick={() => setIsExpanded(prev => !prev)}
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
