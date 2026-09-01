import { auth } from "torneos/server/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  
  // 👈 Hacemos un cast seguro para evitar el error de TypeScript
  const user = req.auth?.user as { onboarded?: boolean } | undefined;
  const isOnboarded = user?.onboarded;
  
  const isOnboardingPage = nextUrl.pathname.startsWith("/onboarding");
  const isAuthPage = nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname.startsWith("/login");

  // Las llamadas a /api (como tRPC) no deben ser redirigidas a HTML
  if (nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Si está logueado pero no completó onboarding
  if (isLoggedIn && !isOnboarded && !isOnboardingPage) {
    return NextResponse.redirect(new URL("/onboarding", nextUrl));
  }

  // Si ya completó onboarding e intenta ir a /onboarding, sacarlo de ahí
  if (isLoggedIn && isOnboarded && isOnboardingPage) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};