// Open-Meteo's air quality API is free and key-less, mirroring the weather
// API's request pattern. We use the European Air Quality Index (european_aqi).
const AIR_QUALITY_API_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Fetch the current European AQI (plus particulate matter) for a coordinate.
// Returns { aqi, pm25, pm10 } or null if the value is unavailable.
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
