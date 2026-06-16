// Wikidata provides free, structured facts about places via its public API
// (no key required). We resolve the entity by its Wikipedia page title and pull
// a few well-known properties (population, area, founding year).
const WIKIDATA_API_BASE = 'https://www.wikidata.org/w/api.php';

const PROPERTY = {
  population: 'P1082',
  area: 'P2046',     // km²
  inception: 'P571', // founding / inception date
};

// Claim values are deeply nested; pull the first claim's main value for a
// property, or null if the property is absent.
function claimValue(entity, property) {
  return entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value ?? null;
}

// Quantity values look like { amount: "+60321", unit: "1" }.
function parseQuantity(value) {
  if (value?.amount == null) return null;
  const n = Number(value.amount);
  return Number.isFinite(n) ? n : null;
}

// Time values look like { time: "+1811-00-00T00:00:00Z", ... }. Returns the
// year as a number (negative for BCE), or null if it can't be parsed.
function parseYear(value) {
  const match = /^([+-])(\d+)-/.exec(value?.time ?? '');
  if (!match) return null;
  const year = parseInt(match[2], 10);
  if (!Number.isFinite(year) || year === 0) return null;
  return match[1] === '-' ? -year : year;
}

// Fetch structured city facts from Wikidata for a Wikipedia page title. `site`
// is the Wikipedia site id the title belongs to (e.g. 'enwiki', 'dewiki').
// Returns an object with only the fields that have data, or null if the entity
// is missing or none of the fields are present.
export async function fetchWikidataFacts(wikipediaTitle, site = 'enwiki') {
  if (!wikipediaTitle) return null;

  const url = new URL(WIKIDATA_API_BASE);
  Object.entries({
    action: 'wbgetentities',
    sites: site,
    titles: wikipediaTitle,
    props: 'claims',
    format: 'json',
    origin: '*',
  }).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);

  const data = await response.json();
  // A missing title resolves to an entity keyed "-1" carrying a `missing` flag.
  const entity = Object.values(data?.entities ?? {})[0];
  if (!entity || entity.missing !== undefined || !entity.claims) return null;

  const population = parseQuantity(claimValue(entity, PROPERTY.population));
  const area = parseQuantity(claimValue(entity, PROPERTY.area));
  const founded = parseYear(claimValue(entity, PROPERTY.inception));

  const facts = {};
  if (population != null) facts.population = Math.round(population);
  if (area != null) facts.area = area;
  if (founded != null) facts.founded = founded;

  return Object.keys(facts).length > 0 ? facts : null;
}

export default { fetchWikidataFacts };
