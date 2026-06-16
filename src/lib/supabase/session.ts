import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If env vars are missing, let the request through — the app will show
    // a clear error when pages try to use the Supabase client.
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Guard the auth check with a timeout. If the Supabase project is paused,
  // slow, or unreachable, `getUser()` can hang until the platform kills the
  // middleware (504 MIDDLEWARE_INVOCATION_TIMEOUT) — which takes the entire
  // site down, including the login page. Race it against a timeout and treat
  // any failure as "logged out" so routes still respond instead of 504-ing.
  const AUTH_TIMEOUT_MS = 5000;
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;

  try {
    const { data, error: getUserError } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('supabase-auth-timeout')),
          AUTH_TIMEOUT_MS
        )
      ),
    ]);

    if (getUserError) {
      // Invalid API key, paused project, etc. Log and treat as unauthenticated
      // (the login page itself surfaces a clearer message on sign-in attempts).
      console.error(
        '[middleware] Supabase auth.getUser error — check env vars and whether the project is paused:',
        getUserError.message
      );
    } else {
      user = data.user;
    }
  } catch (err) {
    // Network failure or timeout — degrade gracefully instead of returning a
    // 504 for every route. Public/login routes render; protected routes fall
    // through to the redirect-to-login logic below.
    console.error(
      '[middleware] Supabase auth check failed or timed out — serving the app in a logged-out state:',
      err instanceof Error ? err.message : err
    );
  }

  // Redirect unauthenticated users to login
  // Skip API routes — they return proper 401 JSON responses themselves
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/operations';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
