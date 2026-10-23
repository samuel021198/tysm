import { NextResponse, type NextRequest } from "next/server";

const guarded = ["/cart", "/checkout", "/orders", "/sell", "/add", "/story", "/messages", "/notifications", "/me", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const needsAuth = guarded.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!needsAuth || request.cookies.get("tysm_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/cart/:path*", "/checkout/:path*", "/orders/:path*", "/sell/:path*", "/add/:path*", "/story/:path*", "/messages/:path*", "/notifications/:path*", "/me/:path*", "/admin/:path*"],
};
