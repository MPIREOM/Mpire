import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { canAccessFinance } from '@/lib/roles';
import type { Role } from '@/types/database';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single();

  if (!caller || !canAccessFinance(caller.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { project_id, file_name, column_mapping, records } = body;

  if (!project_id || !file_name || !column_mapping || !Array.isArray(records)) {
    return NextResponse.json(
      { error: 'project_id, file_name, column_mapping, and records are required' },
      { status: 400 }
    );
  }

  // Get current version number
  const { data: lastUpload } = await supabase
    .from('finance_uploads')
    .select('version')
    .eq('project_id', project_id)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (lastUpload?.version ?? 0) + 1;

  // Create upload record
  const { data: upload, error: uploadError } = await supabase
    .from('finance_uploads')
    .insert({
      project_id,
      uploaded_by: authUser.id,
      file_name,
      column_mapping,
      row_count: records.length,
      version: nextVersion,
    })
    .select()
    .single();

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  // Delete existing records for this project (replace dataset)
  await supabase
    .from('finance_records')
    .delete()
    .eq('project_id', project_id);

  // Insert new records
  const financeRecords = records.map((r: { month: string; category: string; amount: number }) => ({
    project_id,
    upload_id: upload.id,
    month: r.month,
    category: r.category,
    amount: r.amount,
  }));

  const { error: recordsError } = await supabase
    .from('finance_records')
    .insert(financeRecords);

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 400 });
  }

  return NextResponse.json({ upload, recordCount: records.length });
}
