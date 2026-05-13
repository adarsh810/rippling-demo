import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('rpl_bulk_changes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('rpl_bulk_changes')
    .insert({
      event_type: body.event_type,
      event_description: body.event_description,
      change_type: body.change_type ?? 'simple',
      status: 'draft',
      created_by: 'Adarsh Attavar',
      ai_suggestions: body.ai_suggestions ?? {},
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await supabase.from('rpl_audit_log').insert({
    bulk_change_id: data.id,
    action: 'created',
    actor: 'Adarsh Attavar',
    details: { event_type: body.event_type },
  })

  return Response.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from('rpl_bulk_changes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
