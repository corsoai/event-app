import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  { path: "/admin", roles: ["estate_admin", "super_admin"] },
  { path: "/super-admin", roles: ["super_admin"] },
  { path: "/cso", roles: ["cso", "estate_admin", "super_admin"] },
  { path: "/resident", roles: ["resident"] },
  { path: "/security", roles: ["security_guard"] }
];

const roleHome: Record<string, string> = {
  super_admin: "/super-admin",
  estate_admin: "/admin",
  cso: "/cso",
  resident: "/resident",
  security_guard: "/security",
  vendor: "/resident/digital-id"
};

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const route = protectedRoutes.find((item) => pathname.startsWith(item.path));

  if (!route) {
    return NextResponse.next();
  }

  const role = request.cookies.get("corso_role")?.value;

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!route.roles.includes(role)) {
    return NextResponse.redirect(new URL(roleHome[role] ?? "/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/super-admin/:path*", "/cso/:path*", "/resident/:path*", "/security/:path*"]
};
