// Funciones puras de rutas. Sin imports de runtime: el middleware (edge)
// y login-form.tsx las comparten.

const ANON_EXACT_PATHS = new Set(["/", "/torneos"]);

// Un solo segmento después del prefijo. /torneos/xyz/gestion NO matchea.
const ANON_SEGMENT_PATTERNS = [/^\/canchas\/[^/]+$/, /^\/torneos\/[^/]+$/];

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** Vitrina de calle. ENABLED/PUBLIC se validan en servidor (engine), no aquí. */
export function isAnonymousPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (
    ANON_EXACT_PATHS.has(path) ||
    ANON_SEGMENT_PATTERNS.some((re) => re.test(path))
  );
}

/** callbackUrl: solo path interno relativo. Rechaza //, /\, esquemas absolutos. */
export function isSafeInternalPath(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\");
}

export const DEFAULT_AUTHENTICATED_PATH = "/";