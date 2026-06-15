const WIKI_API_BASE = "https://en.wikipedia.org/w/api.php";
const WIKI_REST_BASE = "https://en.wikipedia.org/api/rest_v1";

//Helper for MediaWiki API requests
async function query(params) {
  const url = new URL(WIKI_API_BASE);

  Object.entries({
    format: "json",
    origin: "*",
    ...params,
  }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Wikipedia API request failed: ${response.status}`);
  }

  return response.json();
}

//Search Wikipedia pages by title/content
export async function search(queryText) {
  const data = await query({
    action: "query",
    list: "search",
    srsearch: queryText,
  });

  return data?.query?.search ?? [];
}

//Get page summary by title
export async function getSummary(title) {
  const response = await fetch(
    `${WIKI_REST_BASE}/page/summary/${encodeURIComponent(title)}`
  );

  if (!response.ok) {
    throw new Error(`Wikipedia summary request failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    title: data.title,
    summary: data.extract ?? null,
    url: data.content_urls?.desktop?.page ?? null,
    thumbnail: data.thumbnail?.source ?? null,
    description: data.description ?? null,
    coordinates: data.coordinates ?? null,
  };
}

//Search for place and return summary
export async function getLocationSummary(placeName) {
  const results = await search(placeName);
  const firstResult = results[0];

  if (!firstResult) {
    return null;
  }

  return getSummary(firstResult.title);
}

// Find Wikipedia articles near a coordinate
async function geosearch(lat, lng, { radius = 10000, limit = 10 } = {}) {
  const data = await query({
    action: 'query',
    list: 'geosearch',
    gscoord: `${lat}|${lng}`,
    gsradius: radius,
    gslimit: limit,
  });
  return data?.query?.geosearch ?? [];
}

// Great-circle distance in meters between two coordinates.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// A search hit further than this from the searched coordinate is treated as a
// same-name article somewhere else and rejected.
const MAX_NAMED_DISTANCE_M = 75000;

// Resolve a Wikipedia summary for a user-typed place name (e.g. a search
// result like "Bodensee") near a coordinate. Uses free-text search so the
// returned article reflects the search term rather than the nearest city, and
// rejects a top hit that sits far from the coordinate (guards against
// unrelated same-name articles). Returns null if nothing suitable is found,
// so callers can fall back to a city-level lookup.
export async function getNamedLocationSummary(lat, lng, name) {
  if (!name) return null;

  const results = await search(name);
  const first = results[0];
  if (!first) return null;

  const summary = await getSummary(first.title);
  const coords = summary.coordinates;
  if (
    coords &&
    haversineMeters(lat, lng, coords.lat, coords.lon) > MAX_NAMED_DISTANCE_M
  ) {
    return null;
  }
  return summary;
}

// Fetch city-level Wikipedia summary using coordinate search + city name matching.
// Returns null if no geographically matching city article is found.
export async function getCityLocationSummary(lat, lng, cityName) {
  if (!cityName) return null;

  const candidates = await geosearch(lat, lng);
  const cityLower = cityName.toLowerCase();
  const match = candidates.find((c) => c.title.toLowerCase() === cityLower);

  if (!match) return null;

  return getSummary(match.title);
}

async function searchCommonsJpgs(query, limit = 15) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query',
    generator: 'search',
    gsrnamespace: 6,
    gsrsearch: query,
    gsrlimit: limit,
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: 600,
    format: 'json',
    origin: '*',
  }).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Commons API failed: ${response.status}`);
  const data = await response.json();
  return Object.values(data?.query?.pages ?? {});
}

function pickBestLandscape(pages) {
  const candidates = pages
    .filter((p) => /\.(jpe?g)$/i.test(p.title))
    .map((p) => {
      const info = p.imageinfo?.[0] ?? {};
      const w = info.width ?? 0;
      const h = info.height ?? 0;
      const ratio = h > 0 ? w / h : 0;
      return { info, pixels: w * h, ok: w > h && ratio >= 1.2 && ratio <= 3.5 };
    })
    .filter((c) => c.ok);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.pixels - a.pixels);
  const best = candidates[0].info;
  return best.thumburl ?? best.url ?? null;
}

// Fetch a scenic .jpg photo of the city from Wikimedia Commons.
// Searches by city name so the result is consistent regardless of where in the city was clicked.
// Prefers panorama/skyline shots; falls back to any city photo.
// Returns the photo URL string, or null if none found.
export async function getCommonsGeoPhoto(lat, lng, { cityName = null } = {}) {
  if (!cityName) return null;

  const [panoramaResult, skylineResult] = await Promise.allSettled([
    searchCommonsJpgs(`${cityName} panorama`),
    searchCommonsJpgs(`${cityName} skyline`),
  ]);

  const scenicPages = [
    ...(panoramaResult.status === 'fulfilled' ? panoramaResult.value : []),
    ...(skylineResult.status === 'fulfilled' ? skylineResult.value : []),
  ];

  const scenicPick = pickBestLandscape(scenicPages);
  if (scenicPick) return scenicPick;

  // Fallback: any landscape photo of the city
  const fallbackPages = await searchCommonsJpgs(cityName, 30).catch(() => []);
  return pickBestLandscape(fallbackPages);
}

// FOR FUTURE: returns page metadata
export async function getPage(title) {
  return query({
    action: "query",
    prop: "info|pageimages|coordinates|description",
    piprop: "original",
    titles: title,
  });
}

export default {
  search,
  getSummary,
  getLocationSummary,
  getNamedLocationSummary,
  getCityLocationSummary,
  getCommonsGeoPhoto,
  getPage,
};