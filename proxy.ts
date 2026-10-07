import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isBlockedBot } from "./lib/bots";

/**
 * Turn away crawlers that ignore robots.txt before any page renders, so they
 * never reach the SportScore backend. See lib/bots.ts for the list and why
 * search, AdSense and link-preview bots are left alone.
 */
export function proxy(request: NextRequest) {
  if (isBlockedBot(request.headers.get("user-agent"))) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }
  return NextResponse.next();
}

export const config = {
  // Pages and API routes only. robots.txt stays reachable so a bot can read
  // that it is disallowed; static assets are never routed to the backend.
  matcher: [
    "/((?!_next/static|_next/image|robots\\.txt|ads\\.txt|sitemap\\.xml|favicon|icon|apple-icon|ads/|.*\\.(?:png|jpg|svg|webp|ico)$).*)",
  ],
};
