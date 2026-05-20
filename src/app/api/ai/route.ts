import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, description, documentContext, eventType, employees, changeType } = body

  if (mode === 'infer') {
    const docSection = documentContext
      ? `\n\nSupporting document content (use this for additional context):\n"""\n${documentContext.slice(0, 6000)}\n"""`
      : ''

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `You are an AI assistant embedded in Rippling's bulk change workflow.
Given a natural language description of an HR event (and optionally a supporting document), classify it and suggest relevant employee attributes to change.
Respond ONLY with valid JSON, no markdown.`,
      messages: [{
        role: 'user',
        content: `HR event description: "${description}"${docSection}

Classify this and respond with JSON:
{
  "event_type": "reorg|perf_cycle|schedule_restructure|new_office|device_refresh|contractor_renewal|role_change|custom",
  "event_label": "Human readable label",
  "change_type": "simple|complex",
  "suggested_attrs": ["<pick relevant attrs from the full list below>"],
  "reasoning": "1-2 sentence explanation"
}

Rules:
- change_type is "simple" if the same value applies to all employees (e.g. everyone moves to same office, all contracts extended)
- change_type is "complex" if values differ per employee (e.g. perf-based comp changes, individual promotions)
- suggested_attrs must be a subset of these allowed values ONLY:
    Base (all employees): department, title, compensation, location, manager_id
    Full-time only: equity_grant, pto_days, bonus_target
    Hourly only: hourly_rate, overtime_eligible, shift_type
    Contractor only: contract_end_date, bill_rate, agency_name
- Choose suggested_attrs that match the employment type implied by the event. For contractor renewals use contract_end_date/bill_rate. For hourly schedule changes use shift_type/overtime_eligible. For office moves use location. Do not mix attrs from different employment-type groups unless the event genuinely spans them.`
      }]
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    try {
      const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      const json = JSON.parse(cleaned)
      return Response.json(json)
    } catch {
      return Response.json({ error: 'Parse error', raw: text }, { status: 500 })
    }
  }

  if (mode === 'suggest') {
    const { description: changeDescription } = body
    type EmpInput = {
      name: string; department: string; title: string; location: string
      compensation: number; vertical?: string
      hourly_rate?: number; overtime_eligible?: boolean; shift_type?: string
      equity_grant?: number; bonus_target?: number; pto_days?: number
      bill_rate?: number; agency_name?: string; contract_end_date?: string
    }
    const employeeList = employees.map((e: EmpInput) => {
      const base = `- ${e.name} (${e.vertical ?? 'full_time'}): ${e.title} in ${e.department}, ${e.location}, $${e.compensation.toLocaleString()}`
      const extras: string[] = []
      if (e.vertical === 'hourly') {
        if (e.hourly_rate)          extras.push(`rate: $${e.hourly_rate}/hr`)
        if (e.shift_type)           extras.push(`shift: ${e.shift_type}`)
        if (e.overtime_eligible != null) extras.push(`OT: ${e.overtime_eligible}`)
      } else if (e.vertical === 'contractor') {
        if (e.bill_rate)            extras.push(`bill: $${e.bill_rate}/hr`)
        if (e.agency_name)          extras.push(`agency: ${e.agency_name}`)
        if (e.contract_end_date)    extras.push(`ends: ${e.contract_end_date}`)
      } else {
        if (e.equity_grant)         extras.push(`equity: $${e.equity_grant.toLocaleString()}`)
        if (e.bonus_target)         extras.push(`bonus target: ${e.bonus_target}%`)
        if (e.pto_days)             extras.push(`PTO: ${e.pto_days}d`)
      }
      return extras.length ? `${base} [${extras.join(', ')}]` : base
    }).join('\n')

    const attrHints: Record<string, string> = {
      new_office:           'location → suggest the new office city based on context (default: "Austin")',
      reorg:                'department, title, manager_id → suggest restructured reporting lines; equity_grant or overtime_eligible may change per role',
      perf_cycle:           'compensation → vary 5-15% by performance; bonus_target for FT; hourly_rate for hourly; bill_rate for contractors; title for promotions',
      schedule_restructure: 'hourly_rate, overtime_eligible, shift_type → vary per employee based on new schedule needs',
      device_refresh:       'no attribute changes needed — device policy updates are downstream',
    }

    const docSection = documentContext
      ? `\n\nSupporting document:\n"""\n${documentContext.slice(0, 4000)}\n"""`
      : ''

    const hint = changeDescription
      ? `Admin description: "${changeDescription}"${docSection}`
      : (attrHints[eventType] ?? 'suggest the most relevant attribute changes')

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are an AI assistant in Rippling's bulk change tool. Suggest specific attribute changes for employees based on an HR event and admin description.
Respond ONLY with valid JSON array, no markdown.`,
      messages: [{
        role: 'user',
        content: `Event type: ${eventType}
${hint}

Employees:
${employeeList}

Respond with a JSON array of changes:
[
  {
    "employee_name": "...",
    "attribute": "compensation|title|department|location|manager_id|equity_grant|bonus_target|pto_days|hourly_rate|overtime_eligible|shift_type|bill_rate|agency_name|contract_end_date",
    "new_value": "...",
    "reasoning": "brief reason"
  }
]

Rules:
- Vary values per employee based on their vertical, role, and the admin description
- Only suggest attrs that the employee's vertical supports (hourly employees get hourly_rate/shift_type/overtime_eligible, full-time get equity_grant/bonus_target, contractors get bill_rate/contract_end_date)
- Base attrs (compensation, title, department, location, manager_id) apply to all verticals
- compensation, hourly_rate, bill_rate, equity_grant, bonus_target, pto_days values must be plain numbers
- overtime_eligible values must be "true" or "false"
- Be specific and realistic`
      }]
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    try {
      const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
      const json = JSON.parse(cleaned)
      return Response.json(json)
    } catch {
      return Response.json({ error: 'Parse error', raw: text }, { status: 500 })
    }
  }

  if (mode === 'chat') {
    const { question, changes, employeeCount } = body
    const changesSummary = changes.slice(0, 20).map((c: { employee_name: string; attribute: string; old_value: string; new_value: string }) =>
      `${c.employee_name}: ${c.attribute} ${c.old_value} → ${c.new_value}`
    ).join('\n')

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: `You are an AI assistant helping an HR admin review a bulk employee change in Rippling.
Answer questions about the pending changes concisely (2-3 sentences max).`,
      messages: [{
        role: 'user',
        content: `Bulk change affects ${employeeCount} employees. Sample changes:\n${changesSummary}\n\nAdmin question: ${question}`
      }]
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    return Response.json({ answer: text })
  }

  return Response.json({ error: 'Unknown mode' }, { status: 400 })
}
