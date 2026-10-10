import type { Persona, PersonaSource } from '../types'

export type ParseResult = { persona: Persona } | { error: string }

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const ID = /^[a-z0-9][a-z0-9-]*$/

function unquote(value: string): string {
  const trimmed = value.trim()
  const quoted = trimmed.match(/^(["'])(.*)\1$/)
  return quoted ? (quoted[2] ?? '') : trimmed
}

// A small YAML subset: `key: value` scalars and `key:` followed by `  - item` lists.
export function parseFrontmatter(yaml: string): Record<string, string | string[]> {
  const fields: Record<string, string | string[]> = {}
  let listKey: string | null = null
  for (const line of yaml.split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    const item = line.match(/^\s+-\s+(.*)$/)
    if (item && listKey !== null) {
      const list = fields[listKey]
      if (Array.isArray(list)) list.push(unquote(item[1] ?? ''))
      continue
    }
    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!pair) continue
    const key = pair[1] ?? ''
    const value = pair[2] ?? ''
    if (value === '') {
      fields[key] = []
      listKey = key
    } else {
      fields[key] = unquote(value)
      listKey = null
    }
  }
  return fields
}

function asList(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value.filter(entry => entry !== '') : []
}

export function parsePersona(text: string, source: PersonaSource): ParseResult {
  const match = text.match(FENCE)
  if (!match) return { error: 'no frontmatter' }
  const fields = parseFrontmatter(match[1] ?? '')
  const { id, name, tagline, color, quote } = fields
  if (typeof id !== 'string' || !ID.test(id)) return { error: 'missing or invalid id' }
  if (typeof name !== 'string' || name === '') return { error: 'missing name' }
  return {
    persona: {
      id,
      name,
      tagline: typeof tagline === 'string' ? tagline : '',
      color: typeof color === 'string' ? color : '',
      quote: typeof quote === 'string' ? quote : '',
      spinner: asList(fields.spinner),
      footer: asList(fields.footer),
      body: (match[2] ?? '').trim(),
      source,
    },
  }
}
