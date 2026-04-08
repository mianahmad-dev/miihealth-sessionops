import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  const isLoginPage = nextUrl.pathname === "/login";
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();

  if (isLoginPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/assistants", nextUrl));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const adminRoutes = ["/audit", "/evaluation", "/assistants/new"];
  if (adminRoutes.some((r) => nextUrl.pathname.startsWith(r))) {
    const role = (req.auth?.user as { role?: string })?.role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/forbidden", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
