import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, description, eventType, employees, changeType } = body

  if (mode === 'infer') {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `You are an AI assistant embedded in Rippling's bulk change workflow.
Given a natural language description of an HR event, classify it and suggest relevant employee attributes to change.
Respond ONLY with valid JSON, no markdown.`,
      messages: [{
        role: 'user',
        content: `HR event description: "${description}"

Classify this and respond with JSON:
{
  "event_type": "reorg|perf_cycle|new_office|device_refresh|custom",
  "event_label": "Human readable label",
  "change_type": "simple|complex",
  "suggested_attrs": ["department","title","compensation","location","manager_id"],
  "reasoning": "1-2 sentence explanation"
}

Rules:
- change_type is "simple" if same value applies to all (e.g. everyone moves to same office)
- change_type is "complex" if values differ per employee (e.g. perf-based comp changes)
- suggested_attrs must be subset of: department, title, compensation, location, manager_id`
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
    const employeeList = employees.map((e: { name: string; department: string; title: string; location: string; compensation: number }) =>
      `- ${e.name}: ${e.title} in ${e.department}, ${e.location}, $${e.compensation.toLocaleString()}`
    ).join('\n')

    const attrHints: Record<string, string> = {
      new_office: 'location → suggest the new office city based on context (default: "Austin")',
      reorg: 'department → suggest new department; title may need updating',
      perf_cycle: 'compensation → suggest 5-15% increase; title may be promoted',
      device_refresh: 'no attribute changes needed — device policy updates are downstream',
    }

    const hint = changeDescription
      ? `Admin description: "${changeDescription}"`
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
    "attribute": "compensation|title|department|location|manager",
    "new_value": "...",
    "reasoning": "brief reason"
  }
]

Rules:
- For complex/per-employee changes: vary values per employee based on their context and the admin description
- Only include changes that make sense given the description
- compensation values must be numbers (no $ or commas)
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
