import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";
import type { Role } from "@prisma/client";

const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/kitchen", roles: ["KITCHEN"] },
  { prefix: "/api/kitchen", roles: ["KITCHEN"] },
  { prefix: "/api/uploads", roles: ["KITCHEN"] },
  { prefix: "/nurse", roles: ["NURSE"] },
  { prefix: "/api/nurse", roles: ["NURSE"] },
  { prefix: "/ses", roles: ["SES"] },
  { prefix: "/edu", roles: ["EDU"] },
  { prefix: "/api/ses", roles: ["SES", "EDU"] },
  { prefix: "/api/prescriptions", roles: ["KITCHEN", "SES"] },
  { prefix: "/training", roles: ["ADMIN", "SES"] },
  { prefix: "/api/training", roles: ["ADMIN", "SES"] },
];

const PUBLIC_PATHS = ["/login", "/p/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/auth") || pathname.startsWith("/api/p/")) {
    return NextResponse.next();
  }

  const rule = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session || !rule.roles.includes(session.role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Рұқсат жоқ" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/kitchen/:path*", "/nurse/:path*", "/ses/:path*", "/edu/:path*", "/training/:path*", "/api/:path*"],
};
