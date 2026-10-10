export function pickSpinner(list: readonly string[], random: number): string | null {
  if (list.length === 0) return null
  return list[Math.min(list.length - 1, Math.floor(random * list.length))] ?? null
}

// ui.render fires again on scroll and on invalidate, so the footer word is derived, never random.
export function footerWord(list: readonly string[], durationMs: number): string | null {
  if (list.length === 0) return null
  return list[Math.abs(Math.floor(durationMs)) % list.length] ?? null
}
