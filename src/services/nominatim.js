/**
 * @file Thin wrapper around the public Nominatim (OpenStreetMap) geocoder.
 * Exposes reverse geocoding (coord → place) and forward geocoding (query → coords).
 */

const BASE_URL = 'https://nominatim.openstreetmap.org';

/**
 * Result of {@link reverseGeocode}.
 * @typedef {Object} NominatimReverseResult
 * @property {string} placeName - Best human-readable name derived from address tags; falls back to `display_name` or `"Unknown location"`.
 * @property {string|null} cityName - City / town / village / municipality when known, otherwise null.
 * @property {string|null} country - Full country name, or null.
 * @property {string|null} countryCode - ISO 3166-1 alpha-2 code, lowercase (from Nominatim's `country_code`).
 * @property {string|null} address - Full street-level address (`"<road> <house_number>, <postcode> <city>"`); null when no road is known.
 * @property {string|null} osmType - OSM address/feature type (from Nominatim's `addresstype` or `type`), e.g. `"city"`, `"attraction"`; null when unknown.
 * @property {string|null} osmClass - OSM feature class (Nominatim's `class`), e.g. `"boundary"`, `"tourism"`; null when unknown.
 */

/**
 * Reverse-geocode a coordinate via the public Nominatim endpoint.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<NominatimReverseResult>}
 */
export async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `${BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&extratags=1&namedetails=1`,
    { headers: { 'Accept-Language': 'en' } },
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

  const cityName = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null;

  const country = addr.country ?? null;
  const countryCode = addr.country_code ?? null;

  // Full street-level address, built only when a road is known. House number
  // is appended to the road; postcode and city form the second part.
  const road = addr.road ?? null;
  let address = null;
  if (road) {
    const street = addr.house_number ? `${road} ${addr.house_number}` : road;
    const locality = [addr.postcode, cityName].filter(Boolean).join(' ');
    address = [street, locality].filter(Boolean).join(', ');
  }

  return {
    placeName,
    cityName,
    country,
    countryCode,
    address,
    osmType: data.addresstype ?? data.type ?? null,
    osmClass: data.class ?? null,
  };
}

/**
 * One entry returned by {@link forwardGeocode}.
 * @typedef {Object} NominatimForwardResult
 * @property {string} displayName - Nominatim's full `display_name` string.
 * @property {string} name - Short label: the result's `name`, or the first segment of `display_name`, or `"Unknown"`.
 * @property {string|null} type - Nominatim result type (e.g. `"city"`, `"attraction"`), or null.
 * @property {string|null} country - Deduplicated `"county, state, country"` subtitle string, or null.
 * @property {number} lat
 * @property {number} lng
 */

/**
 * Forward-geocode a free-text query via the public Nominatim search endpoint.
 * @param {string} query - Search terms; will be URL-encoded.
 * @param {Object} [options]
 * @param {number} [options.limit=5] - Maximum number of results to return.
 * @param {AbortSignal} [options.signal] - Optional signal to cancel the request.
 * @returns {Promise<NominatimForwardResult[]>}
 * @throws {Error} When the HTTP response is not OK.
 */
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
      type: r.addresstype ?? r.type ?? null,
      country: subtitle,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    };
  });
}
