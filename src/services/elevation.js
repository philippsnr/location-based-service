const ELEVATION_API_BASE = 'https://api.open-meteo.com/v1/elevation';

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
