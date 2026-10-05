import test from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonLoose } from './parse-json-loose.ts'

test('parses valid json', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 })
})

test('strips markdown fences', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 })
})

test('repairs raw quotes inside strings (real Gemini failure)', () => {
  const raw = '{"feedback": "Use `ws["B"][4:]` then done", "overallScore": 30}'
  assert.deepEqual(parseJsonLoose(raw), { feedback: 'Use `ws["B"][4:]` then done', overallScore: 30 })
})

test('repairs raw newlines inside strings', () => {
  assert.deepEqual(parseJsonLoose('{"a": "line1\nline2"}'), { a: 'line1 line2' })
})

test('returns null for truncated json', () => {
  assert.equal(parseJsonLoose('{"a": 1, "feedback": "cut off'), null)
})

test('returns null for garbage', () => {
  assert.equal(parseJsonLoose('not json at all'), null)
})

test('returns null for json primitives', () => {
  assert.equal(parseJsonLoose('"just a string"'), null)
})
