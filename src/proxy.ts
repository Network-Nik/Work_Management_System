import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// ---------------------------------------------------------------------------
// Route categories
// ---------------------------------------------------------------------------
//
// PUBLIC (no session required) — implicit fall-through:
//   /            /login         /sign-up       /auth/*
//
// AUTHENTICATED (session required, no staff-profile check):
//   /register    /pending
//
// APPROVED_STAFF (session required; Server Component must call
//   requireApprovedStaff() for the full DB-backed check):
//   /dashboard   /tasks/*       /team/*        /notifications/*
//   /history/*   /admin/*

/**
 * Paths that require an active session but do NOT require approved-staff
 * status. The Server Component for each of these routes is responsible for
 * any finer-grained access check.
 */
const AUTHENTICATED_PREFIXES = ["/register", "/pending"];

/**
 * Paths that require both an active session AND approved-staff status.
 * The proxy only enforces the session requirement (optimistic, no DB call).
 * The Server Component for each route must call requireApprovedStaff() to
 * enforce the approved-staff check securely.
 */
const APPROVED_STAFF_PREFIXES = [
  "/dashboard",
  "/tasks",
  "/team",
  "/notifications",
  "/history",
  "/admin",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => {
    if (prefix === "/") {
      // The root is an exact match only — avoid catching everything.
      return pathname === "/";
    }
    return pathname === prefix || pathname.startsWith(prefix + "/");
  });
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  // 1. Always refresh the Supabase session first so that Server Components
  //    downstream read up-to-date auth state from the cookie.
  const { response, isAuthenticated } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // 2. Determine which category the current path falls into.
  const isAuthenticatedRoute = matchesPrefix(pathname, AUTHENTICATED_PREFIXES);
  const isApprovedStaffRoute = matchesPrefix(pathname, APPROVED_STAFF_PREFIXES);

  // 3. Unauthenticated users may not access authenticated-only or
  //    approved-staff routes. Redirect them to /login.
  if (!isAuthenticated && (isAuthenticatedRoute || isApprovedStaffRoute)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Authenticated users who hit an approved-staff route are let through
  //    here. The Server Component must call requireApprovedStaff() to perform
  //    the secure DB-backed check and handle the unapproved case.
  //    (Doing a DB call in the Proxy would run on every prefetch/navigation
  //    and is explicitly discouraged by the Next.js docs.)

  // 5. All other paths (public routes, or authenticated routes for
  //    authenticated users) proceed normally with the refreshed session.
  //    Carry any updated Set-Cookie headers from step 1 in the response.
  return response;
}

export const config = {
  matcher: [
    /*
     * Match every path except:
     *   - Next.js internals (_next/static, _next/image)
     *   - favicon and common static-asset extensions
     * This mirrors the original matcher so the session is always refreshed.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
