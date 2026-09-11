/**
 * Indexing policy for pages whose content comes from the backend.
 *
 * Every content page here is `force-dynamic`, so whatever state it happens to be
 * in when Googlebot arrives is what gets indexed. During a backend outage that
 * state is an error notice — and a crawl that landed during one put the load-error
 * text into the live Google result for the homepage, in place of the fixtures.
 *
 * So a page declares itself indexable only when it actually has its content. The
 * rule is the same everywhere it applies, which is why it lives here rather than
 * being re-derived per route:
 *
 *   • `follow` is kept even when not indexing. The crawler should still walk
 *     through to the other sections; refusing to index this render says nothing
 *     about the links on it.
 *   • `noindex` is evaluated per crawl, not remembered. A page that fails today
 *     and succeeds tomorrow is indexed tomorrow, with no action needed.
 *   • An EMPTY page counts as having no content, not just a failed one. A fixture
 *     list with nothing in it is not a page worth ranking, and indexing it would
 *     put a thin-content signal on the site's strongest URLs.
 */
export const INDEX_FOLLOW = { index: true, follow: true } as const;
export const NOINDEX_FOLLOW = { index: false, follow: true } as const;

/** `hasContent` is the page's own answer to "did the data arrive?". */
export function robotsFor(hasContent: boolean) {
  return hasContent ? INDEX_FOLLOW : NOINDEX_FOLLOW;
}
