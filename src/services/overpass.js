const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export const POI_FILTERS = [
  { id: 'restaurant',  label: 'Restaurants',  emoji: '🍽️', color: '#ff6b35', tagKey: 'amenity', tagValue: 'restaurant',  radius: 1000, nodesOnly: true },
  { id: 'cafe',        label: 'Cafés',         emoji: '☕',  color: '#8b5cf6', tagKey: 'amenity', tagValue: 'cafe',         radius: 1000, nodesOnly: true },
  { id: 'supermarket', label: 'Supermarkets',  emoji: '🛒', color: '#10b981', tagKey: 'shop',    tagValue: 'supermarket', radius: 2000, nodesOnly: false },
  { id: 'pharmacy',    label: 'Pharmacy',      emoji: '💊', color: '#ef4444', tagKey: 'amenity', tagValue: 'pharmacy',    radius: 1000, nodesOnly: true },
  { id: 'atm',         label: 'ATM',           emoji: '🏧', color: '#0ea5e9', tagKey: 'amenity', tagValue: 'atm',         radius: 500,  nodesOnly: true },
  { id: 'bar',         label: 'Bars',          emoji: '🍸', color: '#d946ef', tagKey: 'amenity', tagValue: 'bar',         radius: 1000, nodesOnly: true },
  { id: 'hotel',       label: 'Hotels',        emoji: '🏨', color: '#f59e0b', tagKey: 'tourism', tagValue: 'hotel',       radius: 2000, nodesOnly: false },
  { id: 'museum',      label: 'Museums',       emoji: '🏛️', color: '#0d9488', tagKey: 'tourism', tagValue: 'museum',      radius: 3000, nodesOnly: false },
  { id: 'bus_stop',      label: 'Bus Stops',      emoji: '🚌', color: '#2563eb', tagKey: 'highway', tagValue: 'bus_stop', radius: 500,  nodesOnly: true },
  { id: 'train_station', label: 'Train Stations', emoji: '🚆', color: '#1d4ed8', tagKey: 'railway', tagValue: 'station',  radius: 5000, nodesOnly: false },
];

// Keyed by `${filterId}_${lat.toFixed(2)}_${lng.toFixed(2)}` (~1 km grid)
const cache = new Map();

async function postOverpass(url, query, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.remark && /timed out|runtime error/i.test(data.remark)) {
    throw new Error('Overpass timeout');
  }
  return data;
}

// Race all endpoints — first successful response wins, rest are cancelled.
async function queryOverpass(query, signal) {
  const inner = new AbortController();
  signal?.addEventListener('abort', () => inner.abort(), { once: true });
  try {
    const data = await Promise.any(
      OVERPASS_ENDPOINTS.map(url => postOverpass(url, query, inner.signal))
    );
    inner.abort();
    return data;
  } catch {
    if (signal?.aborted) throw Object.assign(new Error(''), { name: 'AbortError' });
    throw new Error('All Overpass endpoints failed');
  }
}

export async function fetchPois(lat, lng, filterId, signal) {
  const filter = POI_FILTERS.find(f => f.id === filterId);
  if (!filter) return [];

  const cacheKey = `${filterId}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const latPad = filter.radius / 111320;
  const lngPad = filter.radius / (111320 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lat - latPad},${lng - lngPad},${lat + latPad},${lng + lngPad}`;
  const tag = `["${filter.tagKey}"="${filter.tagValue}"]`;
  const query = filter.nodesOnly
    ? `[out:json][timeout:10];node${tag}(${bbox});out center 50;`
    : `[out:json][timeout:10];(node${tag}(${bbox});way${tag}(${bbox}););out center 50;`;

  const data = await queryOverpass(query, signal);

  const results = data.elements
    .map(el => ({
      id: el.id,
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
      name: el.tags?.name ?? filter.label,
      filterType: filterId,
      tags: el.tags ?? {},
    }))
    .filter(poi => poi.lat != null && poi.lng != null);

  cache.set(cacheKey, results);
  return results;
}
