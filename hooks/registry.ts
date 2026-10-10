import type { PersonaSource, Registry } from '../types'
import { parsePersona } from './frontmatter'

// Subcommand names of /persona; a persona with one of these ids could never be selected.
export const RESERVED: readonly string[] = ['off', 'create', 'doctor', 'reload']

export function emptyRegistry(): Registry {
  return { personas: {}, skipped: [] }
}

// Adds one persona file to the registry, or records why it was skipped. `text` is null when
// the file could not be read; a later call with the same id replaces an earlier one.
export function ingest(into: Registry, file: string, text: string | null, isLink: boolean, source: PersonaSource): void {
  if (text === null) {
    into.skipped.push({ file, reason: isLink ? 'broken symlink' : 'unreadable' })
    return
  }
  const parsed = parsePersona(text, source)
  if ('error' in parsed) {
    into.skipped.push({ file, reason: parsed.error })
  } else if (RESERVED.includes(parsed.persona.id)) {
    into.skipped.push({ file, reason: `reserved id "${parsed.persona.id}"` })
  } else {
    into.personas[parsed.persona.id] = parsed.persona
  }
}
