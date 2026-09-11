import { auth } from "torneos/server/auth";
import { NextResponse } from "next/server";
import {
  isAnonymousPath,
  isSafeInternalPath,
  DEFAULT_AUTHENTICATED_PATH,
} from "torneos/lib/anon-access";

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // API (incluye /api/auth y tRPC): nunca redirect a HTML
  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  // Cast igual al que ya usabas: onboarded viaja en la sesión pero no está tipado
  const user = req.auth?.user as { onboarded?: boolean } | undefined;
  const isOnboarded = !!user?.onboarded;

  const isAuthPage = pathname === "/login" || pathname === "/login-dev";

  // Páginas de auth: anónimo pasa; logueado rebota
  if (isAuthPage) {
    if (!isLoggedIn) return NextResponse.next();
    if (!isOnboarded) return NextResponse.redirect(new URL("/onboarding", nextUrl));
    const callbackUrl = nextUrl.searchParams.get("callbackUrl");
    const target =
      callbackUrl && isSafeInternalPath(callbackUrl)
        ? callbackUrl
        : DEFAULT_AUTHENTICATED_PATH;
    return NextResponse.redirect(new URL(target, nextUrl));
  }

  // Sin sesión: solo allowlist anónima pasa (vitrina)
  if (!isLoggedIn) {
    if (isAnonymousPath(pathname)) return NextResponse.next();
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Con sesión sin onboarding: solo /onboarding
  if (!isOnboarded) {
    if (pathname === "/onboarding") return NextResponse.next();
    return NextResponse.redirect(new URL("/onboarding", nextUrl));
  }

  // Onboarded: fuera de /onboarding
  if (pathname === "/onboarding") {
    return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_PATH, nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};