const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const RADIUS_METERS = 1000;

export const POI_FILTERS = [
  { id: 'restaurant', label: 'Restaurants', emoji: '🍽️', color: '#ff6b35', tagKey: 'amenity', tagValue: 'restaurant' },
  { id: 'cafe',       label: 'Cafés',        emoji: '☕',  color: '#8b5cf6', tagKey: 'amenity', tagValue: 'cafe' },
  { id: 'supermarket', label: 'Supermarkets', emoji: '🛒', color: '#10b981', tagKey: 'shop',    tagValue: 'supermarket' },
];

export async function fetchPois(lat, lng, filterId) {
  const filter = POI_FILTERS.find(f => f.id === filterId);
  if (!filter) return [];

  const tag = `["${filter.tagKey}"="${filter.tagValue}"]`;
  const around = `(around:${RADIUS_METERS},${lat},${lng})`;
  const query = `[out:json][timeout:15];(node${tag}${around};way${tag}${around};);out center;`;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);

  const data = await response.json();
  return data.elements
    .map(el => ({
      id: el.id,
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
      name: el.tags?.name ?? filter.label,
    }))
    .filter(poi => poi.lat != null && poi.lng != null);
}
