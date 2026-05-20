import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const url  = formData.get('url')  as string | null

  // Google Docs link
  if (url) {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    if (!match) return Response.json({ error: 'Invalid Google Docs URL — make sure it is a /document/d/... link' }, { status: 400 })
    const docId = match[1]
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`
    try {
      const r = await fetch(exportUrl)
      if (!r.ok) throw new Error('Could not fetch document — make sure it is publicly shared (Anyone with the link → Viewer)')
      const text = await r.text()
      return Response.json({ text: text.trim(), source: 'Google Docs' })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 400 })
    }
  }

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv')
  const isTXT = file.type === 'text/plain' || file.name.endsWith('.txt')
  const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf')

  // CSV / plain text — read directly
  if (isCSV || isTXT) {
    const text = await file.text()
    return Response.json({ text: text.trim(), source: file.name })
  }

  // PDF — send to Claude for extraction
  if (isPDF) {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = await (client.messages.create as any)({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: 'Extract all meaningful content from this document: key facts, numbers, dates, people, decisions, criteria, and context. Return only the extracted content as plain text — no commentary, no formatting.',
          },
        ],
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    return Response.json({ text, source: file.name })
  }

  return Response.json({ error: 'Unsupported file type. Use PDF, CSV, or TXT.' }, { status: 400 })
}
