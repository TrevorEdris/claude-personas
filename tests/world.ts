import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

export const HOME = '/home/tester'
const USER_DIR = `${HOME}/.claude/personas`

// file name -> file text; null stands for a broken symlink.
export type Files = Record<string, string | null>

export type WorldOptions = { bundled?: Files; user?: Files; store?: Record<string, unknown> }

export type WorldLog = { statuses: (string | undefined)[]; toasts: string[] }

// Answers every engine call the plugin makes, from memory, and records what it shows.
export function world(on: On, options: WorldOptions = {}): WorldLog {
  const log: WorldLog = { statuses: [], toasts: [] }
  const dirOf = (path: string): Files | undefined =>
    path === USER_DIR ? options.user : path.endsWith('/personas') ? options.bundled : undefined
  mock.store(on, options.store ?? {})
  mock.env(on, { HOME })
  on('fs.exists', (_$, e) => ({ value: dirOf(e.path) !== undefined }))
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
    const slash = e.path.lastIndexOf('/')
    const text = dirOf(e.path.slice(0, slash))?.[e.path.slice(slash + 1)]
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
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return log
}

export function personaFile(id: string): string {
  return `---\nid: ${id}\nname: ${id.toUpperCase()}\ntagline: The ${id} tagline\nspinner:\n  - ${id} spins\nfooter:\n  - ${id}ed\n---\n\n## Voice Guide\n${id} voice body\n`
}
