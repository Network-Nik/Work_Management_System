import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export type UpdateSessionResult = {
  response: NextResponse;
  /** True when a valid JWT was present in the request cookies. */
  isAuthenticated: boolean;
};

export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Refresh the session before Server Components read authentication state.
  // getClaims() returns null when no valid JWT is present.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = data?.claims != null;

  return { response, isAuthenticated };
}
