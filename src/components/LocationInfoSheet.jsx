import { Sheet, BlockTitle, Block, Link, PageContent } from 'framework7-react';

function LocationInfoSheet({ opened, onClosed, locationInfo, loading }) {
  return (
    <Sheet
      className="location-info-sheet"
      opened={opened}
      onSheetClosed={onClosed}
      swipeToClose
      swipeHandler=".sheet-modal-swipe-step"
      backdrop={false}
      closeByBackdropClick={false}
      closeByOutsideClick={false}
      style={{ height: 'auto', maxHeight: '35vh' }}
    >
      <div className="sheet-modal-swipe-step">
        <div className="location-info-sheet__handle" />
      </div>
      <PageContent>
        {!loading && locationInfo?.wikiThumbnail && (
          <img
            src={locationInfo.wikiThumbnail}
            alt={locationInfo.placeName}
            style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
          />
        )}
        <BlockTitle large>
          {loading ? 'Loading…' : locationInfo?.placeName ?? 'Unknown location'}
        </BlockTitle>
        <Block>
          {loading ? (
            <p>Fetching information…</p>
          ) : locationInfo?.wikiSummary ? (
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
        </Block>
      </PageContent>
    </Sheet>
  );
}

export default LocationInfoSheet;
