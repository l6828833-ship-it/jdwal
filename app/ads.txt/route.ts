const RELATIONSHIP_ID = "f08c47fec0942fa0";

/**
 * AdSense ads.txt.
 *
 * Until Google assigns a real publisher id this returns a comment-only file —
 * never a fake seller declaration. Set ADSENSE_PUBLISHER_ID=pub-123... in the
 * production environment and the valid DIRECT record appears automatically.
 */
export function GET() {
  const raw = process.env.ADSENSE_PUBLISHER_ID?.trim() || "";
  const publisherId = raw.replace(/^ca-/, "");
  const valid = /^pub-\d+$/.test(publisherId);
  const body = valid
    ? `google.com, ${publisherId}, DIRECT, ${RELATIONSHIP_ID}\n`
    : "# AdSense publisher ID not configured yet.\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
