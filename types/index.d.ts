export type PersonaSource = 'bundled' | 'user'

export type Persona = {
  id: string
  name: string
  tagline: string
  // Accent color for the picker (hex or a color name); empty when the file sets none.
  color: string
  // A sample line in the persona's voice, shown in the picker; empty when unset.
  quote: string
  spinner: string[]
  footer: string[]
  body: string
  source: PersonaSource
}

export type Skipped = { file: string; reason: string }

export type Registry = { personas: Record<string, Persona>; skipped: Skipped[] }

declare module 'claude-code' {
  interface PluginState {
    persona: { registry: Registry; spinnerWord: string | null; warnedMissing: boolean; delivered: string | null }
  }
}
