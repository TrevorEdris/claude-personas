import type { Registry } from '../types'
import { INTENSITIES, isIntensity, type Intensity, type Settings } from './settings'

const ID = /^[a-z0-9][a-z0-9-]*$/

export const USAGE = 'Usage: /persona [<id> [minimal|noticeable|excessive] | off | create <id> | doctor | reload]'

export type Action =
  | { kind: 'picker' }
  | { kind: 'off' }
  | { kind: 'doctor' }
  | { kind: 'reload' }
  | { kind: 'create'; id: string }
  | { kind: 'set'; id: string; intensity?: Intensity }
  | { kind: 'error'; text: string }

export function parseArgs(args: string): Action {
  const [first, second, extra] = args.trim().split(/\s+/).filter(word => word !== '')
  if (first === undefined) return { kind: 'picker' }
  if (extra !== undefined) return { kind: 'error', text: USAGE }
  if (first === 'off' || first === 'doctor' || first === 'reload') {
    return second === undefined ? { kind: first } : { kind: 'error', text: USAGE }
  }
  if (first === 'create') {
    return second !== undefined && ID.test(second)
      ? { kind: 'create', id: second }
      : { kind: 'error', text: 'Usage: /persona create <id> (lowercase letters, digits and dashes).' }
  }
  if (second === undefined) return { kind: 'set', id: first }
  if (!isIntensity(second)) {
    return { kind: 'error', text: `Unknown intensity "${second}". Valid: ${INTENSITIES.join(', ')}.` }
  }
  return { kind: 'set', id: first, intensity: second }
}

export function listText(registry: Registry, settings: Settings): string {
  const lines = Object.keys(registry.personas)
    .sort()
    .map(id => {
      const persona = registry.personas[id]!
      return `${id === settings.persona ? '▸' : ' '} ${id} — ${persona.name}: ${persona.tagline} (${persona.source})`
    })
  return [`Intensity: ${settings.intensity}`, ...lines, '', USAGE].join('\n')
}

export function doctorText(registry: Registry): string {
  const loaded = Object.keys(registry.personas)
    .sort()
    .map(id => `  ${id} (${registry.personas[id]!.source})`)
  const skipped = registry.skipped.map(skip => `  ${skip.file}: ${skip.reason}`)
  return ['Loaded:', ...loaded, 'Skipped:', ...(skipped.length > 0 ? skipped : ['  none'])].join('\n')
}
