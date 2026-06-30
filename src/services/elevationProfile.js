const ELEVATION_API_BASE = 'https://api.open-meteo.com/v1/elevation';
const SAMPLE_COUNT = 100;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// coords: GeoJSON LineString coordinates [[lng, lat], ...]
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

// geojsonCoords: [[lng, lat], ...] from OSRM GeoJSON response
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
