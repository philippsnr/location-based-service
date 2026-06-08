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

// Fetch the first geotagged .jpg photo from Wikimedia Commons near the given coordinates.
// Returns the photo URL string, or null if none found.
export async function getCommonsGeoPhoto(lat, lng, { radius = 10000, limit = 10 } = {}) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${lat}|${lng}`,
    ggsradius: radius,
    ggslimit: limit,
    ggsnamespace: 6,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: 600,
    format: 'json',
    origin: '*',
  }).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Commons API failed: ${response.status}`);
  const data = await response.json();

  const pages = Object.values(data?.query?.pages ?? {});
  const jpgPage = pages.find((p) => /\.(jpe?g)$/i.test(p.title));
  const info = jpgPage?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
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
  getCityLocationSummary,
  getCommonsGeoPhoto,
  getPage,
};