'use client'

import { useState } from 'react'
import {
  Upload, FileSpreadsheet, FileText, Code, Loader2, CheckCircle, XCircle,
  Database, Calculator, FileCheck2, Lightbulb, TrendingDown, Target, Wrench, ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from 'cn'

interface CategoryResult {
  score: number
  max: number
  why?: string
  missing: string[]
}

interface EvaluationReport {
  summary?: string
  strengths: string[]
  deductions: string[]
  missing: string[]
  improvements: string[]
}

interface EvaluationResult {
  overallScore: number
  maxScore: number
  breakdown: Record<string, CategoryResult | undefined>
  report?: EvaluationReport
  feedback?: string
  isValid?: boolean
  errors: string[]
}

const CATEGORIES = [
  { key: 'dataQuality', title: 'Data Quality', icon: Database },
  { key: 'calculations', title: 'Calculations', icon: Calculator },
  { key: 'reportCompleteness', title: 'Report Completeness', icon: FileCheck2 },
  { key: 'analysisQuality', title: 'Analysis Quality', icon: Lightbulb },
  { key: 'codeImplementation', title: 'Code Implementation', icon: Code },
] as const

function verdictTone(score: number, max: number) {
  const ratio = max > 0 ? score / max : 0
  if (ratio >= 0.95) {
    return {
      label: 'Full marks',
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      bar: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
    }
  }
  if (ratio >= 0.6) {
    return {
      label: 'Partial credit',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      bar: '[&_[data-slot=progress-indicator]]:bg-amber-500',
    }
  }
  return {
    label: 'Marks lost',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400',
    bar: '[&_[data-slot=progress-indicator]]:bg-red-500',
  }
}

function gradeTone(pct: number) {
  if (pct >= 90) {
    return {
      label: 'Excellent',
      text: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      bar: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
      border: 'border-emerald-500/30',
    }
  }
  if (pct >= 75) {
    return {
      label: 'Good',
      text: 'text-sky-600 dark:text-sky-400',
      badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
      bar: '[&_[data-slot=progress-indicator]]:bg-sky-500',
      border: 'border-sky-500/30',
    }
  }
  if (pct >= 60) {
    return {
      label: 'Satisfactory',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      bar: '[&_[data-slot=progress-indicator]]:bg-amber-500',
      border: 'border-amber-500/30',
    }
  }
  return {
    label: 'Needs work',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400',
    bar: '[&_[data-slot=progress-indicator]]:bg-red-500',
    border: 'border-red-500/30',
  }
}

function BulletList({
  items,
  className,
}: {
  items: string[]
  className: string
}) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug">
          <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', className)} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Home() {
  const [xlsxFile, setXlsxFile] = useState<File | null>(null)
  const [docxFile, setDocxFile] = useState<File | null>(null)
  const [pyFile, setPyFile] = useState<File | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [progress, setProgress] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!xlsxFile || !docxFile) {
      toast.error('XLSX and DOCX files are required')
      return
    }

    setIsEvaluating(true)
    setProgress(0)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('xlsx', xlsxFile)
      formData.append('docx', docxFile)
      if (pyFile) formData.append('py', pyFile)

      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Evaluation failed')
      }

      setResult(data)
      toast.success('Evaluation completed successfully')
    } catch (error) {
      console.error('Evaluation error:', error)
      toast.error(error instanceof Error ? error.message : 'Evaluation failed')
    } finally {
      setIsEvaluating(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  const resetForm = () => {
    setXlsxFile(null)
    setDocxFile(null)
    setPyFile(null)
    setResult(null)
    setProgress(0)
  }

  const overall = result?.overallScore ?? 0
  const maxScore = result?.maxScore ?? 50
  const pct = maxScore > 0 ? (overall / maxScore) * 100 : 0
  const grade = gradeTone(pct)
  const report = result?.report
  const summary = report?.summary || result?.feedback

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">CAP776 Evaluator</h1>
        <p className="text-muted-foreground">My Data, My Story — AI-Powered Project Evaluation</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Project Files</CardTitle>
            <CardDescription>
              Upload your prescribed XLSX workbook and completed DOCX report. The Python file is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="xlsx" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Activity Data (.xlsx) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="xlsx"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setXlsxFile(e.target.files?.[0] || null)}
                  disabled={isEvaluating}
                />
                {xlsxFile && <p className="truncate text-sm text-muted-foreground">{xlsxFile.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="docx" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Report (.docx) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="docx"
                  type="file"
                  accept=".docx"
                  onChange={(e) => setDocxFile(e.target.files?.[0] || null)}
                  disabled={isEvaluating}
                />
                {docxFile && <p className="truncate text-sm text-muted-foreground">{docxFile.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="py" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Python Library (.py) <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="py"
                  type="file"
                  accept=".py"
                  onChange={(e) => setPyFile(e.target.files?.[0] || null)}
                  disabled={isEvaluating}
                />
                {pyFile && <p className="truncate text-sm text-muted-foreground">{pyFile.name}</p>}
              </div>
            </div>

            <Alert>
              <AlertDescription>
                Submission security: XLSX and DOCX are mandatory. The optional PY file is treated as untrusted text.
              </AlertDescription>
            </Alert>

            {isEvaluating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Evaluating with Gemini...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={isEvaluating || !xlsxFile || !docxFile} className="flex-1">
                {isEvaluating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Evaluate Project
                  </>
                )}
              </Button>
              {(xlsxFile || docxFile || pyFile || result) && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isEvaluating}>
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      {result && (
        <div className="mt-6 space-y-6">
          <Card className={cn('border', grade.border)}>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <div className="flex items-baseline gap-1.5">
                  <span className={cn('text-6xl font-bold tracking-tight tabular-nums', grade.text)}>
                    {overall}
                  </span>
                  <span className="text-2xl font-medium text-muted-foreground">/{maxScore}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">Overall score</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={grade.badge}>{grade.label}</Badge>
                      {result.isValid !== false ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    className={cn('[&_[data-slot=progress-track]]:h-2.5', grade.bar)}
                  />
                  {summary && <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {result.errors.length > 0 && (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>Integrity issues found</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <h2 className="mb-3 text-lg font-semibold">Score Breakdown</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {CATEGORIES.map(({ key, title, icon: Icon }) => {
                const item = result.breakdown[key]
                if (!item) return null
                const tone = verdictTone(item.score, item.max)
                const itemPct = item.max > 0 ? (item.score / item.max) * 100 : 0
                return (
                  <Card key={key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between gap-2 text-base">
                        <span className="flex items-center gap-2">
                          <Icon className="size-4 text-muted-foreground" />
                          {title}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {item.score}/{item.max}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Progress value={itemPct} className={tone.bar} />
                      <Badge variant="outline" className={tone.badge}>{tone.label}</Badge>
                      {item.why && <p className="text-sm leading-relaxed text-muted-foreground">{item.why}</p>}
                      <BulletList items={item.missing} className="bg-red-500" />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {(report || result.feedback) && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Report</CardTitle>
                <CardDescription>What was done well, what cost marks, and what to fix</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!report?.summary && result.feedback && (
                  <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                    {result.feedback.split(/\n{2,}/).map((para, i) => (
                      <p key={i}>{para.replace(/^#+\s*/gm, '').trim()}</p>
                    ))}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="size-4" />
                        Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BulletList items={report?.strengths ?? []} className="bg-emerald-500" />
                    </CardContent>
                  </Card>

                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                        <TrendingDown className="size-4" />
                        Why you lost marks
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BulletList items={report?.deductions ?? []} className="bg-amber-500" />
                    </CardContent>
                  </Card>

                  <Card className="border-sky-500/30 bg-sky-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-400">
                        <Target className="size-4" />
                        What&apos;s missing &amp; how to improve
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Missing</p>
                        <BulletList items={report?.missing ?? []} className="bg-red-500" />
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <Wrench className="size-3" /> Improvements
                        </p>
                        <BulletList items={report?.improvements ?? []} className="bg-sky-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
