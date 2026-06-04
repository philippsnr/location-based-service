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
  getPage,
};