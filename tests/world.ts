import type { On } from 'claude-code'
import { mock, type Engine } from 'claude-code/testing'

export const HOME = '/home/tester'
const USER_DIR = `${HOME}/.claude/personas`

// file name -> file text; null stands for a broken symlink.
export type Files = Record<string, string | null>

export type WorldOptions = { bundled?: Files; user?: Files; store?: Record<string, unknown> }

export type WorldLog = { statuses: (string | undefined)[]; toasts: string[]; writes: Record<string, string> }

// Answers every engine call the plugin makes, from memory, and records what it shows.
export function world(on: On, options: WorldOptions = {}): WorldLog {
  const log: WorldLog = { statuses: [], toasts: [], writes: {} }
  const dirOf = (path: string): Files | undefined =>
    path === USER_DIR ? options.user : path.endsWith('/personas') ? options.bundled : undefined
  const fileOf = (path: string): string | null | undefined => {
    const slash = path.lastIndexOf('/')
    return dirOf(path.slice(0, slash))?.[path.slice(slash + 1)]
  }
  mock.store(on, options.store ?? {})
  mock.env(on, { HOME })
  on('fs.exists', (_$, e) => ({ value: dirOf(e.path) !== undefined || typeof fileOf(e.path) === 'string' }))
  on('fs.list', (_$, e) => ({
    value: Object.entries(dirOf(e.path) ?? {}).map(([name, text]) => ({
      name,
      kind: (text === null ? 'other' : 'file') as 'other' | 'file',
      size: 0,
      mtimeMs: 0,
      isLink: text === null,
    })),
  }))
  on('fs.read', (_$, e) => {
    const text = fileOf(e.path)
    return typeof text === 'string' ? { value: text } : { deny: `ENOENT ${e.path}` }
  })
  on('ui.status', (_$, e) => {
    log.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    log.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: false as const, reason: 'no surface in tests' } }))
  on('fs.write', (_$, e) => {
    log.writes[e.path] = e.text
    return { value: undefined }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return log
}

export function personaFile(id: string): string {
  return `---\nid: ${id}\nname: ${id.toUpperCase()}\ntagline: The ${id} tagline\nspinner:\n  - ${id} spins\nfooter:\n  - ${id}ed\n---\n\n## Voice Guide\n${id} voice body\n`
}

// Runs `/persona <args>` the way a typed slash command reaches the plugin.
export function runPersona($: Engine, args: string) {
  return $.command.run({
    command: 'persona',
    args,
    origin: { kind: 'sdk' },
    presentation: { isFullscreen: false, columns: 80 },
  })
}
