const STORAGE_KEY = 'favourite-places';
const COORD_EPSILON = 1e-5;

const listeners = new Set();

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
        typeof item.placeName === 'string'
    );
  } catch (error) {
    console.warn('Failed to read favourites from localStorage:', error);
    return [];
  }
}

function write(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to save favourites to localStorage:', error);
  }
}

function notify() {
  listeners.forEach((fn) => fn());
}

function sameLocation(a, b) {
  return (
    Math.abs(a.lat - b.lat) < COORD_EPSILON &&
    Math.abs(a.lng - b.lng) < COORD_EPSILON
  );
}

export function getFavourites() {
  return read();
}

export function isFavourite(lat, lng) {
  if (lat == null || lng == null) return false;
  return read().some((f) => sameLocation(f, { lat, lng }));
}

export function addFavourite({ placeName, lat, lng }) {
  if (lat == null || lng == null) return;
  const items = read();
  if (items.some((f) => sameLocation(f, { lat, lng }))) return;
  items.push({
    placeName: placeName || 'Unknown location',
    lat,
    lng,
    savedAt: new Date().toISOString(),
  });
  write(items);
  notify();
}

export function removeFavourite(lat, lng) {
  const items = read();
  const next = items.filter((f) => !sameLocation(f, { lat, lng }));
  if (next.length === items.length) return;
  write(next);
  notify();
}

export function toggleFavourite({ placeName, lat, lng }) {
  if (isFavourite(lat, lng)) {
    removeFavourite(lat, lng);
    return false;
  }
  addFavourite({ placeName, lat, lng });
  return true;
}

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
