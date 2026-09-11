/**
 * The boundary between what a failure means internally and what a visitor sees.
 *
 * Every provider module throws errors written for whoever is debugging: they name
 * the backend, quote its URL, and carry the underlying network message. That is
 * the right content for a log and the wrong content for a web page.
 *
 * It was reaching the page. A visitor hitting the site while the backend was
 * down got, in place of the fixtures:
 *
 *   Cannot reach the SportScore backend at https://sportscore-main-git-…run.app.
 *   Is it running? (The operation was aborted due to timeout)
 *
 * Three things wrong with that. It publishes the private URL of an internal
 * service to anyone who sees it, which is an invitation to probe it directly. It
 * is English technical text on an Arabic site, so it reads as broken rather than
 * as a handled condition. And it appeared on every page and every failed section
 * at once, so one outage papered the whole site with the same URL.
 *
 * So failures are translated here, once, into something true and useful in
 * Arabic, and the detail goes to the server log instead. The mapping is by cause,
 * not a single generic apology: "the service is unreachable" and "the data source
 * refused the request" are different situations with different expected recovery,
 * and a reader deserves to know which one they are looking at.
 */

import { t } from "./i18n";

/**
 * Categories a visitor can act on differently, derived from what the provider
 * modules actually throw.
 */
export type FailureKind =
  | "unreachable" //  network fault or timeout reaching the backend
  | "upstream" //     the backend answered, but with an error
  | "quota" //        request budget exhausted
  | "unknown";

/**
 * Categorise a thrown value.
 *
 * Matched on the message text because the provider error classes are not shared
 * across module boundaries here (each provider defines its own), and a `status`
 * field is not present on every path. The tests are deliberately loose: a new
 * phrasing that falls through lands in "unknown", which is still a safe, correct
 * message rather than a leak.
 */
export function classifyFailure(error: unknown): FailureKind {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/budget|quota/i.test(message)) return "quota";
  if (
    /cannot reach|network error|fetch failed|timeout|aborted|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(
      message,
    )
  ) {
    return "unreachable";
  }
  // Every provider prefixes a non-OK upstream response with its own name.
  if (/backend:|api|http \d{3}/i.test(message)) return "upstream";
  return "unknown";
}

/** What the visitor reads. Arabic, no URLs, no internal service names. */
export function publicErrorMessage(error: unknown): string {
  switch (classifyFailure(error)) {
    case "unreachable":
      return t.errorUnreachable;
    case "upstream":
      return t.errorUpstream;
    case "quota":
      return t.quotaBody;
    default:
      return t.errorUnknown;
  }
}

/**
 * The full detail, for the server log only.
 *
 * Called at the point a failure is turned into UI or into a response, so an
 * outage is still diagnosable from the platform's logs — the information did not
 * disappear, it moved to the only place it belonged.
 */
export function logFailure(scope: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`[${scope}]`, detail);
}

/**
 * The raw message, but ONLY in development.
 *
 * Returns null in production, so a component can render it while developing
 * without any risk of it shipping. This is what makes the sanitised message
 * above acceptable to work with: the detail is one `npm run dev` away.
 */
export function developmentDetail(error: unknown): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return error instanceof Error ? error.message : String(error);
}
