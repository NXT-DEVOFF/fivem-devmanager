import { NextResponse, type NextRequest } from "next/server";

function publicOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\//.test(configured)) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!forwardedHost) return request.nextUrl.origin;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${forwardedHost}`;
}

const PUBLIC_PATHS = [
  "/",
  "/presentation",
  "/mentions-legales",
  "/confidentialite",
  "/login",
  "/sitemap.xml",
  "/api/auth/login",
  "/api/health",
  "/api/auth/me",
];

/**
 * Garde de premier niveau : redirige les pages non authentifiees vers /login.
 * La validation complete de la session (hash, expiration, revocation) reste
 * effectuee cote serveur dans chaque page et chaque Route Handler.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname === path) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/monaco") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/media") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  // Les API repondent elles-memes 401 : pas de redirection HTML.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const hasSession = request.cookies.has("fdm_session");
  if (!hasSession) {
    // request.nextUrl utilise l'origine interne (localhost) derriere le reverse
    // proxy. Construire l'URL de redirection depuis APP_URL evite de renvoyer
    // le visiteur vers une adresse locale apres publication.
    const url = new URL("/login", publicOrigin(request));
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Node.js runtime (stable depuis Next 15.5) : evite un bundle Edge qui
  // embarquerait les modules serveur (argon2, node:crypto) via instrumentation.
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
