import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read a server-only env var, bypassing Turbopack's compile-time replacement.
// Falls back to reading .env.local directly from disk.
function getServerEnv(key: string): string | undefined {
  // Bracket notation avoids Turbopack static replacement
  const val = process.env[key];
  if (val) return val;

  // Fallback: parse .env.local at runtime
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, role } = await request.json();

    // Validate input
    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'Email, password, full name, and role are required' },
        { status: 400 }
      );
    }

    if (!['owner', 'manager', 'staff', 'investor'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Verify the caller is authenticated and is owner/manager
    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !authUser) {
      return NextResponse.json(
        { error: 'Session expired — please log in again' },
        { status: 401 }
      );
    }

    const { data: caller } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', authUser.id)
      .single();

    if (!caller || !['owner', 'manager'].includes(caller.role)) {
      return NextResponse.json({ error: 'Only owners and managers can add team members' }, { status: 403 });
    }

    // Create auth user via admin API using service role key
    const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY missing from both process.env and .env.local');
      return NextResponse.json(
        { error: 'Server configuration error — please contact the administrator' },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: newAuthUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // Insert into public.users with the caller's company_id
    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: newAuthUser.user.id,
        email,
        full_name,
        role,
        company_id: caller.company_id,
      });

    if (profileError) {
      // Clean up auth user if profile insert fails
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      user: {
        id: newAuthUser.user.id,
        email,
        full_name,
        role,
      },
    });
  } catch (err) {
    console.error('POST /api/users error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
