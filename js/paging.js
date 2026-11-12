// Paging past the API's row cap (v1.26), pure and Node-tested.
// PostgREST returns at most 1000 rows per request. A ledger that stops
// at the cap shows its oldest month as a part-total with no warning,
// so every "whole table" read goes through here.
//
// fetchPage(from, to) returns one page of rows for that inclusive range,
// in a stable order, and throws on failure. A throw from any page
// escapes as-is and nothing is returned: half a ledger is never handed
// back as if it were all of it.
//
// keyOf (optional) names each row. Paging by position can repeat a row
// when the other phone saves an entry between two requests, and a
// repeated row would be counted twice in every total; with keyOf the
// second copy is dropped.

export const PAGE_SIZE = 1000;

export async function fetchAllPages(fetchPage, { pageSize = PAGE_SIZE, keyOf = null } = {}) {
  const all = [];
  const seen = new Set();
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (!Array.isArray(page)) throw new Error("The ledger came back incomplete.");
    for (const row of page) {
      if (keyOf) {
        const key = keyOf(row);
        if (seen.has(key)) continue;
        seen.add(key);
      }
      all.push(row);
    }
    // a short page is the last one; a full page may not be, so ask again
    if (page.length < pageSize) return all;
  }
}
