import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { GoogleGenAI } from '@google/genai'
import { parseJsonLoose } from '@/lib/parse-json-loose'

const MAX_FILE_SIZE = 10 * 1024 * 1024

interface EvaluationResult {
  overallScore?: unknown
  breakdown?: unknown
  report?: unknown
  feedback?: unknown
  isValid?: unknown
  errors?: unknown
}

const CATEGORY_MAX: Record<string, number> = {
  dataQuality: 10,
  calculations: 15,
  reportCompleteness: 10,
  analysisQuality: 10,
  codeImplementation: 5,
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim())
    : []
}

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}
const ALLOWED_XLSX = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
const ALLOWED_DOCX = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request: expected multipart form data' }, { status: 400 })
  }
  try {
    const xlsxFile = formData.get('xlsx') as File | null
    const docxFile = formData.get('docx') as File | null
    const pyFile = formData.get('py') as File | null

    if (!xlsxFile || !docxFile) {
      return NextResponse.json({ error: 'XLSX and DOCX files are mandatory' }, { status: 400 })
    }

    if (xlsxFile.size > MAX_FILE_SIZE || docxFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }
    if (pyFile && pyFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    if (!xlsxFile.name.endsWith('.xlsx') && !ALLOWED_XLSX.includes(xlsxFile.type)) {
      return NextResponse.json({ error: 'Invalid XLSX file type' }, { status: 400 })
    }
    if (!docxFile.name.endsWith('.docx') && !ALLOWED_DOCX.includes(docxFile.type)) {
      return NextResponse.json({ error: 'Invalid DOCX file type' }, { status: 400 })
    }

    const xlsxBuffer = await xlsxFile.arrayBuffer()
    const xlsxWorkbook = XLSX.read(new Uint8Array(xlsxBuffer), { type: 'array', cellDates: true })
    const xlsxJson = xlsxWorkbook.SheetNames.map(name => ({
      name,
      data: XLSX.utils.sheet_to_json(xlsxWorkbook.Sheets[name], { defval: null })
    }))

    const docxBuffer = await docxFile.arrayBuffer()
    const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(docxBuffer) })
    const docxText = docxResult.value

    let pyCode = ''
    if (pyFile) {
      pyCode = await pyFile.text()
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const evaluationPrompt = `You are evaluating a CAP776 (Programming in Python) Minor Project #1 submission.
Project: "My Data, My Story - Personal Activity Intelligence Report"

Rules you must check against the inputs below:
- Only activity records from 17 August 2026 to 21 September 2026 count.
- The XLSX is the numerical source of truth; the DOCX report must agree with it.
- Index formulas: TPI = avg coding/day; AAI = avg(study+class)/day; PhAI = avg fitness/day;
  SRI = avg sleep/day; ABI = avg free/unaccounted/day; TUI = avg total tracked/day;
  EI = avg over days of (feeling+satisfaction+energy)/3 with feeling and satisfaction scored
  5/4/3/2/1 and energy 3/2/1; DCI = validDays/expectedDays * 100;
  PAI = 0.15*TPI + 0.20*AAI + 0.15*PhAI + 0.20*SRI + 0.15*TUI + 0.10*EI + 0.05*DCI.
- Registration number must match between the XLSX file name / header and the DOCX.
- Section 3 needs 3 findings, each with evidence from the data; sections 4 and 5 must each
  be 100-200 words.
- The .py file is never executed: judge only whether its logic would compute the indices
  correctly from the XLSX.

Score out of 50: dataQuality 10, calculations 15, reportCompleteness 10,
analysisQuality 10, codeImplementation 5.

Return ONLY this JSON shape, no markdown fences, no extra keys. Every "why" must cite the
specific number, section or formula involved; every "missing" item must be a concrete thing
that cost marks.

{
  "overallScore": <number 0-50>,
  "maxScore": 50,
  "breakdown": {
    "dataQuality": {"score": <0-10>, "max": 10, "why": "<1-2 sentences>", "missing": ["<...>"]},
    "calculations": {"score": <0-15>, "max": 15, "why": "<1-2 sentences>", "missing": ["<...>"]},
    "reportCompleteness": {"score": <0-10>, "max": 10, "why": "<1-2 sentences>", "missing": ["<...>"]},
    "analysisQuality": {"score": <0-10>, "max": 10, "why": "<1-2 sentences>", "missing": ["<...>"]},
    "codeImplementation": {"score": <0-5>, "max": 5, "why": "<1-2 sentences>", "missing": ["<...>"]}
  },
  "report": {
    "summary": "<2-3 sentence overall assessment>",
    "strengths": ["<what was done well, with evidence>"],
    "deductions": ["<specific reason marks were lost, naming the section, number or formula>"],
    "missing": ["<required element that is absent or wrong>"],
    "improvements": ["<actionable fix, most important first>"]
  },
  "isValid": true,
  "errors": ["<only real integrity problems: registration mismatch, dates outside the window, report values disagreeing with the XLSX, ...; empty array if none>"]
}

Input XLSX JSON: ${JSON.stringify(xlsxJson)}

Input DOCX Text: ${docxText}

Input PY Code (optional): ${pyCode}`

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: evaluationPrompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 32768,
        responseMimeType: 'application/json',
      },
    })

    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      return NextResponse.json(
        { error: 'Gemini ran out of output tokens before finishing — please try again' },
        { status: 502 }
      )
    }

    const evaluationResult = parseJsonLoose(response.text || '') as EvaluationResult | null
    if (!evaluationResult) {
      console.error('Unparseable Gemini output:', (response.text || '').slice(0, 500))
      return NextResponse.json(
        { error: 'Gemini returned unreadable output — please try again' },
        { status: 502 }
      )
    }

    const rawBreakdown =
      typeof evaluationResult.breakdown === 'object' && evaluationResult.breakdown !== null
        ? (evaluationResult.breakdown as Record<string, unknown>)
        : {}
    const breakdown: Record<string, { score: number; max: number; why?: string; missing: string[] }> = {}
    for (const [key, max] of Object.entries(CATEGORY_MAX)) {
      const entry = rawBreakdown[key]
      const raw = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
      breakdown[key] = {
        score: Math.max(0, Math.min(max, asNumber(raw.score))),
        max,
        why: asString(raw.why) ?? asString(raw.comments),
        missing: asStringArray(raw.missing),
      }
    }

    const rawReport =
      typeof evaluationResult.report === 'object' && evaluationResult.report !== null
        ? (evaluationResult.report as Record<string, unknown>)
        : {}

    return NextResponse.json({
      overallScore: Math.max(0, Math.min(50, asNumber(evaluationResult.overallScore))),
      maxScore: 50,
      breakdown,
      report: {
        summary: asString(rawReport.summary),
        strengths: asStringArray(rawReport.strengths),
        deductions: asStringArray(rawReport.deductions),
        missing: asStringArray(rawReport.missing),
        improvements: asStringArray(rawReport.improvements),
      },
      feedback: asString(evaluationResult.feedback),
      isValid: evaluationResult.isValid !== false,
      errors: asStringArray(evaluationResult.errors),
    })
  } catch (error) {
    console.error('API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
      return NextResponse.json(
        { error: 'Gemini API quota exceeded — wait a few hours and try again' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 500 })
  }
}
