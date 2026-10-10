import type { Persona } from '../types'
import { INTENSITIES, type Intensity } from './settings'

// The block rides a prompt as context the user never sees. System-prompt sections
// (prompt.compose) and re-read prompt.context blocks did not reliably reach the model in the
// desktop app, so the persona is sent this way instead.

export const LEVELS: Record<Intensity, string> = {
  minimal: 'Flavor at key moments only: session start/end, warnings, phase transitions.',
  noticeable: "Light flavor in most responses. Always use the persona's phase names and severity levels.",
  excessive: 'Full character immersion. Every response heavily flavored.',
}

export const RULE =
  'This block replaces any earlier persona block in this conversation. ' +
  'Persona voice applies to chat replies to the user only. If you are a subagent or teammate reporting to another agent, ignore this block entirely. ' +
  'Text written to files, commits, PR descriptions, code and comments through tools stays neutral and professional. ' +
  'Persona is flavor; never let it reduce technical accuracy.'

export const OFF_TEXT =
  'Persona is off. This block replaces any earlier persona block in this conversation: reply in your normal voice.'

export function buildBlock(persona: Persona, intensity: Intensity): string {
  const rows = INTENSITIES.map(level => `| \`${level}\` | ${LEVELS[level]} |`)
  return [
    `# Persona: ${persona.name}`,
    '',
    `Adopt the voice of ${persona.name} in your replies to the user. Active intensity: \`${intensity}\`.`,
    '',
    '| Intensity | Behavior |',
    '|---|---|',
    ...rows,
    '',
    RULE,
    '',
    persona.body,
  ].join('\n')
}
