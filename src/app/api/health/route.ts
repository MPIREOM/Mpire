import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — diagnose Supabase connectivity and API key validity.
 * Returns a JSON report so you can quickly see what's misconfigured.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check environment variables are present
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  results.env = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'set' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey
      ? `set (${anonKey.length} chars, starts with ${anonKey.slice(0, 20)}…)`
      : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey
      ? `set (${serviceRoleKey.length} chars, starts with ${serviceRoleKey.slice(0, 20)}…)`
      : 'MISSING',
  };

  if (!supabaseUrl || !anonKey) {
    results.status = 'error';
    results.message = 'Cannot test connection — required environment variables are missing.';
    return NextResponse.json(results, { status: 500 });
  }

  // 2. Test anon key by hitting the REST API
  try {
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // A lightweight query — just check if the API responds
    const { error: anonError } = await anonClient.from('users').select('id').limit(1);
    results.anon_key_test = anonError
      ? { status: 'error', message: anonError.message, code: anonError.code }
      : { status: 'ok' };
  } catch (err) {
    results.anon_key_test = {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // 3. Test service role key (if set)
  if (serviceRoleKey) {
    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: adminError } = await adminClient.from('users').select('id').limit(1);
      results.service_role_key_test = adminError
        ? { status: 'error', message: adminError.message, code: adminError.code }
        : { status: 'ok' };
    } catch (err) {
      results.service_role_key_test = {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    results.service_role_key_test = { status: 'skipped', message: 'Key not set' };
  }

  // 4. Overall status
  const anonOk = (results.anon_key_test as { status: string }).status === 'ok';
  const serviceOk = (results.service_role_key_test as { status: string }).status === 'ok'
    || (results.service_role_key_test as { status: string }).status === 'skipped';

  if (anonOk && serviceOk) {
    results.status = 'healthy';
  } else {
    results.status = 'unhealthy';
    results.hint =
      'If you see "Invalid API key", your Supabase project may be paused. ' +
      'Go to https://supabase.com/dashboard → select your project → click "Restore" if it says paused. ' +
      'Also double-check that the keys in Vercel match the ones in your Supabase dashboard (Settings → API).';
  }

  return NextResponse.json(results, { status: anonOk ? 200 : 500 });
}
