export const INTENSITIES = ['minimal', 'noticeable', 'excessive'] as const

export type Intensity = (typeof INTENSITIES)[number]

export type Settings = { persona: string; intensity: Intensity }

export function isIntensity(value: unknown): value is Intensity {
  return typeof value === 'string' && (INTENSITIES as readonly string[]).includes(value)
}

// Normalizes raw store values: the persona starts as off and the intensity as noticeable.
export function toSettings(persona: unknown, intensity: unknown): Settings {
  return {
    persona: typeof persona === 'string' && persona !== '' ? persona : 'off',
    intensity: isIntensity(intensity) ? intensity : 'noticeable',
  }
}
