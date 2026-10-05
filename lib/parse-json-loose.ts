export function parseJsonLoose(text: string): unknown | null {
  let s = text.trim()
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) s = fence[1]

  for (let i = 0; i < 20; i++) {
    try {
      const parsed = JSON.parse(s)
      return typeof parsed === 'object' && parsed !== null ? parsed : null
    } catch (err) {
      const pos = err instanceof SyntaxError ? /position (\d+)/.exec(err.message)?.[1] : undefined
      if (pos === undefined) return null
      const p = Number(pos)
      if (s[p - 1] === '"') {
        s = s.slice(0, p - 1) + '\\' + s.slice(p - 1)
      } else if (s[p] === '"') {
        s = s.slice(0, p) + '\\' + s.slice(p)
      } else if (p < s.length && s.charCodeAt(p) < 0x20) {
        s = s.slice(0, p) + ' ' + s.slice(p + 1)
      } else {
        return null
      }
    }
  }
  return null
}
