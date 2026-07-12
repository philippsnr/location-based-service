/**
 * @file Fetches free, structured facts about places from Wikidata's public API
 * (no key required). Resolves the entity by its Wikipedia page title and pulls
 * a few well-known properties (population, area, founding year).
 */

const WIKIDATA_API_BASE = 'https://www.wikidata.org/w/api.php';

const PROPERTY = {
  population: 'P1082',
  area: 'P2046',     // km²
  inception: 'P571', // founding / inception date
};

/**
 * Pull the first claim's main value for a property from an entity.
 * @param {Object} entity - A Wikidata entity object.
 * @param {string} property - Wikidata property id (e.g. `"P1082"`).
 * @returns {*|null} The claim's main value, or null when the property is absent.
 */
function claimValue(entity, property) {
  return entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value ?? null;
}

/**
 * Parse a Wikidata quantity value (e.g. `{ amount: "+60321", unit: "1" }`).
 * @param {{amount?: string}} value - A Wikidata quantity datavalue.
 * @returns {number|null} The numeric amount, or null when unparseable.
 */
function parseQuantity(value) {
  if (value?.amount == null) return null;
  const n = Number(value.amount);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a Wikidata time value (e.g. `{ time: "+1811-00-00T00:00:00Z" }`).
 * @param {{time?: string}} value - A Wikidata time datavalue.
 * @returns {number|null} The year as a number (negative for BCE), or null when
 *   it can't be parsed.
 */
function parseYear(value) {
  const match = /^([+-])(\d+)-/.exec(value?.time ?? '');
  if (!match) return null;
  const year = parseInt(match[2], 10);
  if (!Number.isFinite(year) || year === 0) return null;
  return match[1] === '-' ? -year : year;
}

/**
 * Fetch structured city facts from Wikidata for a Wikipedia page title.
 * @param {string} wikipediaTitle - The Wikipedia page title to resolve.
 * @param {string} [site='enwiki'] - Wikipedia site id the title belongs to
 *   (e.g. `"enwiki"`, `"dewiki"`).
 * @returns {Promise<{population?: number, area?: number, founded?: number}|null>}
 *   An object with only the fields that have data, or null when the entity is
 *   missing or none of the fields are present.
 * @throws {Error} When the Wikidata request fails (non-2xx response).
 */
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
