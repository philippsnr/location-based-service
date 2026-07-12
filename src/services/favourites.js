/**
 * @file Persists the user's favourite places in `localStorage` and provides a
 * small pub/sub layer so the UI can react to changes (including edits made in
 * other tabs via the `storage` event).
 */

/**
 * A saved favourite place.
 * @typedef {Object} Favourite
 * @property {string} placeName - Human-readable name of the place.
 * @property {number} lat - Latitude in decimal degrees.
 * @property {number} lng - Longitude in decimal degrees.
 * @property {string|null} [osmType] - OSM feature type of the place (e.g. `"city"`), or null.
 * @property {string} savedAt - ISO-8601 timestamp of when it was saved.
 */

const STORAGE_KEY = 'favourite-places';
const COORD_EPSILON = 1e-5;

const listeners = new Set();

/**
 * Read and validate the favourites list from `localStorage`.
 * @returns {Favourite[]} The stored favourites, or `[]` when missing/corrupt.
 */
function read() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.lat === 'number' &&
        typeof item.lng === 'number' &&
        typeof item.placeName === 'string',
    );
  } catch (error) {
    console.warn('Failed to read favourites from localStorage:', error);
    return [];
  }
}

/**
 * Persist the favourites list to `localStorage`.
 * @param {Favourite[]} items - The list to store.
 * @returns {void}
 */
function write(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to save favourites to localStorage:', error);
  }
}

/**
 * Notify all in-tab subscribers that the favourites changed.
 * @returns {void}
 */
function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Whether two locations refer to the same place, within {@link COORD_EPSILON}.
 * @param {{lat: number, lng: number}} a
 * @param {{lat: number, lng: number}} b
 * @returns {boolean}
 */
function sameLocation(a, b) {
  return Math.abs(a.lat - b.lat) < COORD_EPSILON && Math.abs(a.lng - b.lng) < COORD_EPSILON;
}

/**
 * Get the current list of favourite places.
 * @returns {Favourite[]}
 */
export function getFavourites() {
  return read();
}

/**
 * Whether a coordinate is already in the favourites list.
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {boolean} False when either coordinate is null/undefined.
 */
export function isFavourite(lat, lng) {
  if (lat == null || lng == null) return false;
  return read().some((f) => sameLocation(f, { lat, lng }));
}

/**
 * Add a place to the favourites (no-op if the coordinate is already saved or
 * either coordinate is missing). Notifies subscribers on success.
 * @param {Object} place - The place to save.
 * @param {string} place.placeName - Human-readable name (defaults to
 *   `"Unknown location"` when falsy).
 * @param {number} place.lat - Latitude in decimal degrees.
 * @param {number} place.lng - Longitude in decimal degrees.
 * @param {string|null} [place.osmType=null] - OSM feature type stored with the place.
 * @returns {void}
 */
export function addFavourite({ placeName, lat, lng, osmType = null }) {
  if (lat == null || lng == null) return;
  const items = read();
  if (items.some((f) => sameLocation(f, { lat, lng }))) return;
  items.push({
    placeName: placeName || 'Unknown location',
    lat,
    lng,
    osmType,
    savedAt: new Date().toISOString(),
  });
  write(items);
  notify();
}

/**
 * Remove a place from the favourites (no-op if not present). Notifies
 * subscribers on success.
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {void}
 */
export function removeFavourite(lat, lng) {
  const items = read();
  const next = items.filter((f) => !sameLocation(f, { lat, lng }));
  if (next.length === items.length) return;
  write(next);
  notify();
}

/**
 * Toggle a place in the favourites: remove it if present, otherwise add it.
 * @param {Object} place - The place to toggle.
 * @param {string} place.placeName - Human-readable name (used only when adding).
 * @param {number} place.lat - Latitude in decimal degrees.
 * @param {number} place.lng - Longitude in decimal degrees.
 * @param {string|null} [place.osmType=null] - OSM feature type stored with the place when adding.
 * @returns {boolean} True if the place is now a favourite, false if it was removed.
 */
export function toggleFavourite({ placeName, lat, lng, osmType = null }) {
  if (isFavourite(lat, lng)) {
    removeFavourite(lat, lng);
    return false;
  }
  addFavourite({ placeName, lat, lng, osmType });
  return true;
}

/**
 * Subscribe to favourites changes. Fires on in-tab mutations (add/remove/
 * toggle) and on cross-tab `storage` events for this key.
 * @param {() => void} listener - Called (with no arguments) whenever the list changes.
 * @returns {() => void} Unsubscribe function that removes the listener.
 */
export function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
