import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, role } = await request.json();

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'Email, password, full name, and role are required' },
        { status: 400 }
      );
    }

    if (!['owner', 'manager', 'staff', 'investor'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Validate Supabase URL is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      console.error('POST /api/users: NEXT_PUBLIC_SUPABASE_URL is not set');
      return NextResponse.json(
        { error: 'Server configuration error — NEXT_PUBLIC_SUPABASE_URL is missing' },
        { status: 500 }
      );
    }

    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !authUser) {
      console.error('POST /api/users: auth.getUser failed:', getUserError?.message ?? 'no user');
      return NextResponse.json(
        { error: 'Session expired — please log in again' },
        { status: 401 }
      );
    }

    const { data: caller, error: callerError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', authUser.id)
      .single();

    if (callerError) {
      console.error('POST /api/users: caller profile lookup failed:', callerError.message);
      return NextResponse.json(
        { error: 'Could not verify your permissions — your profile may be missing from the users table' },
        { status: 403 }
      );
    }

    if (!caller || !['owner', 'manager'].includes(caller.role)) {
      return NextResponse.json(
        { error: 'Only owners and managers can add team members' },
        { status: 403 }
      );
    }

    // Service role key from environment — NEVER commit this value
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('POST /api/users: SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json(
        { error: 'Server configuration error — SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      supabaseUrl,
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
      console.error('POST /api/users: auth.admin.createUser failed:', authError.message);
      const isApiKeyError = authError.message?.toLowerCase().includes('invalid api key');
      return NextResponse.json(
        {
          error: isApiKeyError
            ? 'Supabase rejected the service role key — the project may be paused or the key is incorrect. Check your Supabase dashboard and Vercel environment variables.'
            : authError.message,
        },
        { status: isApiKeyError ? 500 : 400 }
      );
    }

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
      console.error('POST /api/users: profile insert failed:', profileError.message, profileError.details, profileError.hint);
      // Roll back the auth user since profile creation failed
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      return NextResponse.json(
        { error: `Failed to create user profile: ${profileError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      user: { id: newAuthUser.user.id, email, full_name, role },
    });
  } catch (err) {
    console.error('POST /api/users unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user_id, password } = await request.json();

    if (!user_id || !password) {
      return NextResponse.json(
        { error: 'user_id and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration error — NEXT_PUBLIC_SUPABASE_URL is missing' },
        { status: 500 }
      );
    }

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

    const { data: caller, error: callerError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (callerError || !caller) {
      return NextResponse.json(
        { error: 'Could not verify your permissions' },
        { status: 403 }
      );
    }

    if (caller.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can change user passwords' },
        { status: 403 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error — SUPABASE_SERVICE_ROLE_KEY is not set' },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: updateError } =
      await adminClient.auth.admin.updateUserById(user_id, { password });

    if (updateError) {
      console.error('PATCH /api/users: updateUserById failed:', updateError.message);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/users unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
