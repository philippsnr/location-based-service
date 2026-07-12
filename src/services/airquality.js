/**
 * @file Thin wrapper around Open-Meteo's free, key-less air quality API,
 * mirroring the weather API's request pattern. Uses the European Air Quality
 * Index (`european_aqi`).
 */

const AIR_QUALITY_API_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/**
 * Result of {@link fetchAirQuality}.
 * @typedef {Object} AirQuality
 * @property {number} aqi - Current European Air Quality Index, rounded.
 * @property {number|null} pm25 - Particulate matter ≤2.5 µm (µg/m³), or null.
 * @property {number|null} pm10 - Particulate matter ≤10 µm (µg/m³), or null.
 */

/**
 * Fetch the current European AQI (plus particulate matter) for a coordinate.
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {Promise<AirQuality|null>} The air quality reading, or null when the
 *   AQI value is unavailable.
 * @throws {Error} When the network request fails (non-2xx response).
 */
export async function fetchAirQuality(lat, lng) {
  const url = new URL(AIR_QUALITY_API_BASE);
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lng);
  url.searchParams.set('current', 'european_aqi,pm2_5,pm10');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Air quality fetch failed: ${response.status}`);

  const data = await response.json();
  const current = data?.current;
  const aqi = current?.european_aqi;
  if (aqi == null) return null;

  return {
    aqi: Math.round(aqi),
    pm25: current.pm2_5 ?? null,
    pm10: current.pm10 ?? null,
  };
}

export default { fetchAirQuality };
