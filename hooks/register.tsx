import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Persona, PersonaSource, Registry } from '../types'
import { BLOCK_NAME, buildBlock, OFF_TEXT } from './block'
import { emptyRegistry, ingest } from './registry'
import { toSettings, type Settings } from './settings'

// The engine follows `$` only into functions declared in this file, so every helper that
// touches `$` lives here; the modules beside it hold pure logic. The state atoms are declared
// here for the same reason.

const EMPTY: Registry = { personas: {}, skipped: [] }

const registryAtom = atom({ plugin: 'persona', key: 'registry' } as const, EMPTY)
const announcedAtom = atom({ plugin: 'persona', key: 'announced' } as const, false)

async function getSettings($: EngineInterface): Promise<Settings> {
  return toSettings(await $.store.get('persona'), await $.store.get('intensity'))
}

// The persona to speak as now, or null when it is off or no longer in the registry.
async function activePersona($: EngineInterface): Promise<{ persona: Persona; settings: Settings } | null> {
  const settings = await getSettings($)
  if (settings.persona === 'off') return null
  const persona = (await read($, registryAtom)).personas[settings.persona]
  return persona ? { persona, settings } : null
}

async function loadDir($: EngineInterface, dir: string, source: PersonaSource, into: Registry): Promise<void> {
  if (!(await $.fs.exists(dir))) return
  for (const entry of await $.fs.list(dir)) {
    if (!entry.name.endsWith('.md') || entry.name.startsWith('_') || entry.kind === 'dir') continue
    const file = `${dir}/${entry.name}`
    let text: string | null
    try {
      // A symlink lists as kind "other", so every .md entry is read and a failed read is recorded.
      text = String(await $.fs.read(file))
    } catch {
      text = null
    }
    ingest(into, file, text, entry.isLink, source)
  }
}

// $.fs does not expand "~", so the user directory is built from HOME.
async function userDir($: EngineInterface): Promise<string | null> {
  const home = await $.env.get('HOME')
  return home ? `${home}/.claude/personas` : null
}

// Bundled personas load first; a user file with the same id replaces the bundled one.
async function reloadRegistry($: EngineInterface): Promise<Registry> {
  const registry = emptyRegistry()
  await loadDir($, `${$.plugin.root}/personas`, 'bundled', registry)
  const dir = await userDir($)
  if (dir !== null) await loadDir($, dir, 'user', registry)
  await update($, registryAtom, () => registry)
  return registry
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await reloadRegistry($)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('prompt.context', async ($, e, next) => {
    const res = await next(e)
    const active = await activePersona($)
    if (active !== null) {
      await update($, announcedAtom, () => true)
      const text = buildBlock(active.persona, active.settings.intensity)
      return { blocks: [...res.blocks, { name: BLOCK_NAME, text }] }
    }
    // Only cancel a persona this conversation has already been given.
    if (await read($, announcedAtom)) return { blocks: [...res.blocks, { name: BLOCK_NAME, text: OFF_TEXT }] }
    return res
  }).catch(($, e, next) => next(e))
}
