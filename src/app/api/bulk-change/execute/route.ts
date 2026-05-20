import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

async function executeChange(id: string) {
  const { data: items } = await supabase
    .from('rpl_bulk_change_items')
    .select('*, employee:rpl_employees(*)')
    .eq('bulk_change_id', id)

  for (const item of (items ?? [])) {
    const field = item.attribute
    const value = field === 'compensation' ? parseFloat(item.new_value) : item.new_value
    await supabase.from('rpl_employees').update({ [field]: value }).eq('id', item.employee_id)
  }

  await supabase.from('rpl_bulk_change_items').update({ status: 'applied' }).eq('bulk_change_id', id)

  const rollbackWindow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('rpl_bulk_changes').update({
    status: 'executed',
    rollback_window_expires_at: rollbackWindow,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  return rollbackWindow
}

export async function POST(req: NextRequest) {
  const { id, action, reason } = await req.json()

  // ── Approve: schedule the change (do NOT execute yet) ────────────────
  if (action === 'approve') {
    await supabase.from('rpl_bulk_changes').update({
      status: 'approved',
      approved_by: 'Jordan Hayes',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    const { data: change } = await supabase.from('rpl_bulk_changes').select('effective_date').eq('id', id).single()

    await supabase.from('rpl_audit_log').insert({
      bulk_change_id: id,
      action: 'approved',
      actor: 'Jordan Hayes',
      details: { approved_at: new Date().toISOString(), effective_date: change?.effective_date },
    })

    return Response.json({ success: true, status: 'approved' })
  }

  // ── Auto-execute: sweep approved changes whose date has arrived ───────
  if (action === 'auto_execute') {
    const today = new Date().toISOString().split('T')[0]
    const { data: overdue } = await supabase
      .from('rpl_bulk_changes')
      .select('id, effective_date')
      .eq('status', 'approved')
      .lte('effective_date', today)

    let count = 0
    for (const change of (overdue ?? [])) {
      const rollbackWindow = await executeChange(change.id)
      await supabase.from('rpl_audit_log').insert({
        bulk_change_id: change.id,
        action: 'auto_executed',
        actor: 'System',
        details: { effective_date: change.effective_date, rollback_window: rollbackWindow },
      })
      count++
    }

    return Response.json({ success: true, executed_count: count })
  }

  // ── Reject ───────────────────────────────────────────────────────────
  if (action === 'reject') {
    await supabase.from('rpl_bulk_changes').update({
      status: 'rejected',
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    await supabase.from('rpl_audit_log').insert({
      bulk_change_id: id,
      action: 'rejected',
      actor: 'Jordan Hayes',
      details: { reason },
    })

    return Response.json({ success: true, status: 'rejected' })
  }

  // ── Rollback ─────────────────────────────────────────────────────────
  if (action === 'rollback') {
    const { data: items } = await supabase
      .from('rpl_bulk_change_items')
      .select('*, employee:rpl_employees(*)')
      .eq('bulk_change_id', id)

    for (const item of (items ?? [])) {
      if (item.old_value !== null) {
        const field = item.attribute
        const value = field === 'compensation' ? parseFloat(item.old_value) : item.old_value
        await supabase.from('rpl_employees').update({ [field]: value }).eq('id', item.employee_id)
      }
    }

    await supabase.from('rpl_bulk_change_items').update({ status: 'rolled_back' }).eq('bulk_change_id', id)
    await supabase.from('rpl_bulk_changes').update({
      status: 'rolled_back',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    await supabase.from('rpl_audit_log').insert({
      bulk_change_id: id,
      action: 'rolled_back',
      actor: 'Adarsh Attavar',
      details: { reason: reason ?? 'Manual rollback' },
    })

    return Response.json({ success: true, status: 'rolled_back' })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
