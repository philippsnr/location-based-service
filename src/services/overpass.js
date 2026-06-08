const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export const POI_FILTERS = [
  { id: 'restaurant',  label: 'Restaurants',  emoji: '🍽️', color: '#ff6b35', tagKey: 'amenity', tagValue: 'restaurant',  radius: 1000 },
  { id: 'cafe',        label: 'Cafés',         emoji: '☕',  color: '#8b5cf6', tagKey: 'amenity', tagValue: 'cafe',         radius: 1000 },
  { id: 'supermarket', label: 'Supermarkets',  emoji: '🛒', color: '#10b981', tagKey: 'shop',    tagValue: 'supermarket', radius: 2000 },
];

// Keyed by `${filterId}_${lat.toFixed(2)}_${lng.toFixed(2)}` (~1 km grid
const cache = new Map();

export async function fetchPois(lat, lng, filterId, signal) {
  const filter = POI_FILTERS.find(f => f.id === filterId);
  if (!filter) return [];

  const cacheKey = `${filterId}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  // Bounding box is much faster than around: in Overpass (uses spatial index)
  const latPad = filter.radius / 111320;
  const lngPad = filter.radius / (111320 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lat - latPad},${lng - lngPad},${lat + latPad},${lng + lngPad}`;
  const tag = `["${filter.tagKey}"="${filter.tagValue}"]`;
  const query = `[out:json][timeout:10];(node${tag}(${bbox});way${tag}(${bbox}););out center 50;`;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });

  if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);

  const data = await response.json();
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
