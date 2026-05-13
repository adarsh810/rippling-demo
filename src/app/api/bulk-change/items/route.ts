import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('bulk_change_id')
  if (!id) return Response.json({ error: 'missing bulk_change_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('rpl_bulk_change_items')
    .select('*, employee:rpl_employees(*)')
    .eq('bulk_change_id', id)
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { bulk_change_id, items } = body

  await supabase.from('rpl_bulk_change_items').delete().eq('bulk_change_id', bulk_change_id)

  if (!items || items.length === 0) return Response.json([])

  const { data, error } = await supabase
    .from('rpl_bulk_change_items')
    .insert(items.map((i: { employee_id: string; attribute: string; old_value: string; new_value: string }) => ({
      bulk_change_id,
      employee_id: i.employee_id,
      attribute: i.attribute,
      old_value: i.old_value,
      new_value: i.new_value,
      status: 'pending',
    })))
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
