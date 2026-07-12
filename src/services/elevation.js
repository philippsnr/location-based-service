/**
 * @file Thin wrapper around Open-Meteo's free, key-less elevation API for
 * resolving the ground elevation of a single coordinate.
 */

const ELEVATION_API_BASE = 'https://api.open-meteo.com/v1/elevation';

/**
 * Fetch the ground elevation for a coordinate.
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {Promise<number>} Elevation in metres, rounded to the nearest metre.
 * @throws {Error} When the request fails or the response contains no elevation.
 */
export async function fetchElevation(lat, lng) {
  const url = new URL(ELEVATION_API_BASE);
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lng);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Elevation fetch failed: ${response.status}`);

  const data = await response.json();
  const elevation = data?.elevation?.[0];
  if (elevation == null) throw new Error('No elevation data in response');
  return Math.round(elevation);
}
