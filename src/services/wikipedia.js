//Get language code from browser
const lang = navigator.language?.split('-')[0] ?? 'en'

//Build Wikipedia API/REST base URLs for a given language code
const apiBase = (language) => `https://${language}.wikipedia.org/w/api.php`;
const restBase = (language) => `https://${language}.wikipedia.org/api/rest_v1`;

//Helper for MediaWiki API requests
async function query(params, language = lang) {
  const url = new URL(apiBase(language));

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
export async function search(queryText, language = lang) {
  const data = await query({
    action: "query",
    list: "search",
    srsearch: queryText,
  }, language);

  return data?.query?.search ?? [];
}

//Get page summary by title. Falls back to the English Wikipedia if the page
//does not exist in the requested language (HTTP 404).
export async function getSummary(title, language = lang) {
  const response = await fetch(
    `${restBase(language)}/page/summary/${encodeURIComponent(title)}`
  );

  if (!response.ok) {
    if (response.status === 404 && language !== 'en') {
      return getSummary(title, 'en');
    }
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
    language,
  };
}

//Search for place and return summary. Falls back to an English-language
//search if the place name has no results in the user's language.
export async function getLocationSummary(placeName) {
  let results = await search(placeName);
  let language = lang;

  if (results.length === 0 && lang !== 'en') {
    results = await search(placeName, 'en');
    language = 'en';
  }

  const firstResult = results[0];
  if (!firstResult) {
    return null;
  }

  return getSummary(firstResult.title, language);
}

// Find Wikipedia articles near a coordinate
async function geosearch(lat, lng, { radius = 10000, limit = 10 } = {}, language = lang) {
  const data = await query({
    action: 'query',
    list: 'geosearch',
    gscoord: `${lat}|${lng}`,
    gsradius: radius,
    gslimit: limit,
  }, language);
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
// unrelated same-name articles). Falls back to the English Wikipedia if the
// name has no results in the user's language. Returns null if nothing
// suitable is found, so callers can fall back to a city-level lookup.
export async function getNamedLocationSummary(lat, lng, name) {
  if (!name) return null;

  let results = await search(name);
  let language = lang;

  if (results.length === 0 && lang !== 'en') {
    results = await search(name, 'en');
    language = 'en';
  }

  const first = results[0];
  if (!first) return null;

  const summary = await getSummary(first.title, language);
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
// Falls back to an English-language geosearch if no matching article exists
// in the user's language. Returns null if no geographically matching city
// article is found.
export async function getCityLocationSummary(lat, lng, cityName) {
  if (!cityName) return null;

  const cityLower = cityName.toLowerCase();

  let candidates = await geosearch(lat, lng);
  let match = candidates.find((c) => c.title.toLowerCase() === cityLower);
  let language = lang;

  if (!match && lang !== 'en') {
    candidates = await geosearch(lat, lng, {}, 'en');
    match = candidates.find((c) => c.title.toLowerCase() === cityLower);
    language = 'en';
  }

  if (!match) return null;

  return getSummary(match.title, language);
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

// Pick up to `max` distinct landscape JPEG URLs from Commons pages, best
// resolution first.
function pickLandscapes(pages, max = 4) {
  const candidates = pages
    .filter((p) => /\.(jpe?g)$/i.test(p.title))
    .map((p) => {
      const info = p.imageinfo?.[0] ?? {};
      const w = info.width ?? 0;
      const h = info.height ?? 0;
      const ratio = h > 0 ? w / h : 0;
      return { info, pixels: w * h, ok: w > h && ratio >= 1.2 && ratio <= 3.5 };
    })
    .filter((c) => c.ok)
    .sort((a, b) => b.pixels - a.pixels);

  const urls = [];
  for (const c of candidates) {
    const url = c.info.thumburl ?? c.info.url ?? null;
    if (url && !urls.includes(url)) urls.push(url);
    if (urls.length >= max) break;
  }
  return urls;
}

// Fetch up to `max` scenic .jpg photos of the city from Wikimedia Commons.
// Searches by city name so the results are consistent regardless of where in
// the city was clicked. Prefers panorama/skyline shots; tops up with any city
// photos if scenic searches don't yield enough. Returns an array of URLs
// (empty if none found).
export async function getCommonsGeoPhotos(lat, lng, { cityName = null, max = 4 } = {}) {
  if (!cityName) return [];

  const [panoramaResult, skylineResult] = await Promise.allSettled([
    searchCommonsJpgs(`${cityName} panorama`),
    searchCommonsJpgs(`${cityName} skyline`),
  ]);

  const scenicPages = [
    ...(panoramaResult.status === 'fulfilled' ? panoramaResult.value : []),
    ...(skylineResult.status === 'fulfilled' ? skylineResult.value : []),
  ];

  const urls = pickLandscapes(scenicPages, max);
  if (urls.length >= max) return urls;

  // Top up with any landscape photos of the city.
  const fallbackPages = await searchCommonsJpgs(cityName, 30).catch(() => []);
  for (const url of pickLandscapes(fallbackPages, max)) {
    if (!urls.includes(url)) urls.push(url);
    if (urls.length >= max) break;
  }
  return urls;
}

// Single-photo convenience wrapper around getCommonsGeoPhotos.
// Returns the best photo URL, or null if none found.
export async function getCommonsGeoPhoto(lat, lng, opts = {}) {
  const urls = await getCommonsGeoPhotos(lat, lng, { ...opts, max: 1 });
  return urls[0] ?? null;
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
  getCommonsGeoPhotos,
  getPage,
};