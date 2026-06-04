import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { detectBot } from "@/lib/bot-detection";
import { recordBotVisit } from "@/lib/bot-tracker";

export const config = {
  // Track only page requests, skip Next.js internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|apple-icon|opengraph-image|twitter-image|icon\\.svg|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpe?g|gif|webp|svg|woff2?|ttf|css|js|map)).*)",
  ],
};

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const ua = request.headers.get("user-agent");
  const botName = detectBot(ua);

  if (botName && ua) {
    // Non-blocking: response returns immediately, the insert runs in the
    // edge function's grace window.
    event.waitUntil(
      recordBotVisit({
        botName,
        userAgent: ua,
        path: request.nextUrl.pathname,
      }).catch((err) => {
        // Schema not yet initialised, network blip, anything — never block
        // the request because of tracking.
        console.error("[bot-tracker]", err);
      }),
    );
  }

  return NextResponse.next();
}
