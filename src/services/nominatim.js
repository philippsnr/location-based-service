const BASE_URL = 'https://nominatim.openstreetmap.org';

export async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `${BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&extratags=1&namedetails=1`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const data = await res.json();

  const addr = data.address ?? {};
  const placeName =
    addr.attraction ||
    addr.tourism ||
    addr.amenity ||
    addr.leisure ||
    addr.historic ||
    addr.building ||
    addr.man_made ||
    addr.natural ||
    addr.park ||
    addr.village ||
    addr.town ||
    addr.city ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.county ||
    addr.state ||
    addr.road ||
    data.name ||
    data.display_name?.split(',')[0] ||
    'Unknown location';

  const cityName =
    addr.city ??
    addr.town ??
    addr.village ??
    addr.municipality ??
    null;

  return { placeName, cityName };
}

export async function forwardGeocode(query, { limit = 5, signal } = {}) {
  const url =
    `${BASE_URL}/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=${limit}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
    signal,
  });
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);
  const data = await res.json();

  return data.map((r) => {
    const addr = r.address ?? {};
    const county = addr.county ?? null;
    const state = addr.state ?? null;
    const country = addr.country ?? null;
    const parts = [county, state, country].filter(Boolean);
    const deduped = parts.filter((p, i) => p !== parts[i - 1]);
    const subtitle = deduped.length > 0 ? deduped.join(', ') : null;
    return {
      displayName: r.display_name,
      name: r.name || r.display_name?.split(',')[0] || 'Unknown',
      type: r.type ?? null,
      country: subtitle,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    };
  });
}