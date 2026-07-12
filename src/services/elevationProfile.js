/**
 * @file Builds an elevation profile for a route by sampling points along its
 * polyline and querying Open-Meteo's elevation API, plus stats (ascent,
 * descent, min/max) derived from the sampled elevations.
 */

const ELEVATION_API_BASE = 'https://api.open-meteo.com/v1/elevation';
const SAMPLE_COUNT = 100;

/**
 * Great-circle distance between two coordinates using the haversine formula.
 * @param {number} lat1 - First point latitude in decimal degrees.
 * @param {number} lng1 - First point longitude in decimal degrees.
 * @param {number} lat2 - Second point latitude in decimal degrees.
 * @param {number} lng2 - Second point longitude in decimal degrees.
 * @returns {number} Distance in metres.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Resample a polyline into `count` points spaced evenly by distance along the
 * line (so densely-noded segments don't over-sample).
 * @param {Array<[number, number]>} coords - GeoJSON LineString coordinates,
 *   each `[lng, lat]`.
 * @param {number} count - Number of evenly-spaced points to produce.
 * @returns {Array<{lat: number, lng: number}>} The sampled points.
 */
function samplePolyline(coords, count) {
  if (coords.length < 2) return [{ lat: coords[0][1], lng: coords[0][0] }];

  const cumDist = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    cumDist.push(cumDist[i - 1] + haversineMeters(lat1, lng1, lat2, lng2));
  }
  const totalDist = cumDist[cumDist.length - 1];

  const samples = [];
  const step = totalDist / (count - 1);

  for (let s = 0; s < count; s++) {
    const targetDist = s === count - 1 ? totalDist : s * step;
    let seg = 0;
    while (seg < cumDist.length - 2 && cumDist[seg + 1] < targetDist) seg++;
    const segLen = cumDist[seg + 1] - cumDist[seg];
    const t = segLen > 0 ? (targetDist - cumDist[seg]) / segLen : 0;
    const [lng1, lat1] = coords[seg];
    const [lng2, lat2] = coords[seg + 1];
    samples.push({ lat: lat1 + t * (lat2 - lat1), lng: lng1 + t * (lng2 - lng1) });
  }

  return samples;
}

/**
 * Fetch an elevation profile for a route by sampling its polyline (up to
 * {@link SAMPLE_COUNT} points) and querying the elevation API in one request.
 * @param {Array<[number, number]>} geojsonCoords - Route coordinates from an
 *   OSRM GeoJSON response, each `[lng, lat]`.
 * @param {AbortSignal} [signal] - Optional signal to cancel the request.
 * @returns {Promise<number[]>} Elevations in metres (rounded), one per sample.
 * @throws {Error} When the request fails or the response contains no elevations.
 */
export async function fetchElevationProfile(geojsonCoords, signal) {
  const count = Math.min(SAMPLE_COUNT, Math.max(2, geojsonCoords.length));
  const points = samplePolyline(geojsonCoords, count);

  const lats = points.map((p) => p.lat.toFixed(6)).join(',');
  const lngs = points.map((p) => p.lng.toFixed(6)).join(',');

  const url = new URL(ELEVATION_API_BASE);
  url.searchParams.set('latitude', lats);
  url.searchParams.set('longitude', lngs);

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Elevation fetch failed: ${response.status}`);

  const data = await response.json();
  const elevations = data?.elevation;
  if (!elevations) throw new Error('No elevation data in response');
  return elevations.map(Math.round);
}

/**
 * Compute summary statistics from a sequence of elevations.
 * @param {number[]} elevations - Elevations in metres, in route order.
 * @returns {{ascent: number, descent: number, minElevation: number, maxElevation: number}}
 *   Total ascent and descent (metres, rounded) plus the min/max elevation.
 */
export function computeElevationStats(elevations) {
  let ascent = 0;
  let descent = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) ascent += diff;
    else descent -= diff;
  }
  return {
    ascent: Math.round(ascent),
    descent: Math.round(descent),
    minElevation: Math.min(...elevations),
    maxElevation: Math.max(...elevations),
  };
}
