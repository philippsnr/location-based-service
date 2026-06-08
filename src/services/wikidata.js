const ENTITY_DATA_URL = 'https://www.wikidata.org/wiki/Special:EntityData';

export async function fetchWikidataImage(qid) {
  const res = await fetch(`${ENTITY_DATA_URL}/${qid}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  const entity = data.entities?.[qid];
  const filename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!filename) return null;
  const encoded = encodeURIComponent(filename.replace(/ /g, '_'));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=400`;
}
