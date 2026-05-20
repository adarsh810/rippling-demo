import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabase
    .from('rpl_bulk_change_templates')
    .select('*')
    .order('created_at', { ascending: false })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { bulk_change_id, name, description } = await req.json()

  const [{ data: change }, { data: items }] = await Promise.all([
    supabase.from('rpl_bulk_changes').select('change_type, created_by').eq('id', bulk_change_id).single(),
    supabase.from('rpl_bulk_change_items').select('attribute').eq('bulk_change_id', bulk_change_id),
  ])

  if (!change) return Response.json({ error: 'Change not found' }, { status: 404 })

  const suggested_attrs = [...new Set((items ?? []).map((i: { attribute: string }) => i.attribute))]

  const { data: template, error } = await supabase
    .from('rpl_bulk_change_templates')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      change_type: change.change_type,
      suggested_attrs,
      created_by: change.created_by,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(template)
}
