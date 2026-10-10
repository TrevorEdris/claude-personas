export type PersonaSource = 'bundled' | 'user'

export type Persona = {
  id: string
  name: string
  tagline: string
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
