import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Persona, PersonaSource, Registry } from '../types'
import { buildBlock, OFF_TEXT } from './block'
import { doctorText, listText, parseArgs, USAGE } from './command'
import { emptyRegistry, ingest } from './registry'
import { INTENSITIES, toSettings, type Intensity, type Settings } from './settings'
import { footerWord, pickSpinner } from './words'

// The engine follows `$` only into functions declared in this file, so every helper that
// touches `$` lives here; the modules beside it hold pure logic. The state atoms are declared
// here for the same reason.

const PANE = 'persona-picker'

const EMPTY: Registry = { personas: {}, skipped: [] }

const registryAtom = atom({ plugin: 'persona', key: 'registry' } as const, EMPTY)
// The persona key (`id:intensity`, or `off`) last attached to a prompt in this conversation.
const deliveredAtom = atom({ plugin: 'persona', key: 'delivered' } as const, null as string | null)
const spinnerWordAtom = atom({ plugin: 'persona', key: 'spinnerWord' } as const, null)
const warnedMissingAtom = atom({ plugin: 'persona', key: 'warnedMissing' } as const, false)

async function getSettings($: EngineInterface): Promise<Settings> {
  return toSettings(await $.store.get('persona'), await $.store.get('intensity'))
}

async function saveSettings($: EngineInterface, settings: Settings): Promise<void> {
  await $.store.set('persona', settings.persona)
  await $.store.set('intensity', settings.intensity)
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

async function refreshStatus($: EngineInterface): Promise<void> {
  const active = await activePersona($)
  $.ui.status(active ? `${active.persona.id} · ${active.settings.intensity}` : undefined)
}

async function warnIfMissing($: EngineInterface): Promise<void> {
  const settings = await getSettings($)
  if (settings.persona === 'off' || (await read($, warnedMissingAtom))) return
  await update($, warnedMissingAtom, () => true)
  $.ui.toast(`persona: "${settings.persona}" not found; running without a persona. Try /persona reload.`)
}

async function afterChange($: EngineInterface): Promise<void> {
  await update($, warnedMissingAtom, () => false)
  await refreshStatus($)
  $.ui.invalidate('ui.render')
}

async function applyPersona($: EngineInterface, id: string, intensity?: Intensity): Promise<string> {
  const registry = await read($, registryAtom)
  const persona = registry.personas[id]
  if (!persona) return `Unknown persona "${id}". Valid: ${[...Object.keys(registry.personas).sort(), 'off'].join(', ')}.`
  const current = await getSettings($)
  const chosen = { persona: id, intensity: intensity ?? current.intensity }
  await saveSettings($, chosen)
  await afterChange($)
  $.ui.toast(`${persona.name}: ${persona.tagline}`)
  return `Persona set to ${id} (${chosen.intensity}).`
}

async function applyOff($: EngineInterface): Promise<string> {
  const current = await getSettings($)
  await saveSettings($, { ...current, persona: 'off' })
  await afterChange($)
  return 'Persona off.'
}

async function applyIntensity($: EngineInterface, intensity: Intensity): Promise<void> {
  const current = await getSettings($)
  await saveSettings($, { ...current, intensity })
  await afterChange($)
}

async function createPersona($: EngineInterface, id: string): Promise<string> {
  const dir = await userDir($)
  if (dir === null) return 'HOME is not set; cannot find ~/.claude/personas.'
  const file = `${dir}/${id}.md`
  if (await $.fs.exists(file)) return `${file} already exists; not overwriting.`
  const template = String(await $.fs.read(`${$.plugin.root}/personas/_template.md`))
  await $.fs.write(file, template.replaceAll('{{id}}', id))
  return `Created ${file}. Fill it in, then run /persona reload.`
}

async function runCommand($: EngineInterface, args: string): Promise<string> {
  const action = parseArgs(args)
  switch (action.kind) {
    case 'error':
      return action.text
    case 'picker': {
      const opened = await $.ui.open({ id: PANE, title: 'Persona' })
      if (opened.isPlaced) return 'Persona picker opened.'
      return listText(await read($, registryAtom), await getSettings($))
    }
    case 'off':
      return applyOff($)
    case 'doctor':
      return doctorText(await read($, registryAtom))
    case 'reload': {
      const registry = await reloadRegistry($)
      await afterChange($)
      return doctorText(registry)
    }
    case 'create':
      return createPersona($, action.id)
    case 'set':
      return applyPersona($, action.id, action.intensity)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await reloadRegistry($)
    await refreshStatus($)
    await $.command.register({
      name: 'persona',
      description: 'Talk to Claude as a character; open the picker or switch persona',
      argumentHint: USAGE.replace('Usage: /persona ', ''),
    })
    return next(e)
  }).catch(($, e, next) => next(e))

  // The persona rides the next prompt as context the user never sees. It is sent again only
  // when the persona or intensity changes, or after a compaction or /clear drops it from history.
  on('prompt.submit', async ($, e, next) => {
    const active = await activePersona($)
    const key = active ? `${active.persona.id}:${active.settings.intensity}` : 'off'
    const delivered = await read($, deliveredAtom)
    // Off needs no block unless this conversation was given a persona to cancel.
    if (key === delivered || (key === 'off' && delivered === null)) return next(e)
    const text = active ? buildBlock(active.persona, active.settings.intensity) : OFF_TEXT
    await update($, deliveredAtom, () => key)
    return next({ ...e, context: [...(e.context ?? []), text] })
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const res = await next(e)
    const isMainCompaction = res.messages !== undefined && e.trigger !== 'precompute' && e.agentId === undefined
    if (isMainCompaction) await update($, deliveredAtom, () => null)
    return res
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, deliveredAtom, () => null)
    return next(e)
  }).catch(($, e, next) => next(e))

  // The spinner word is chosen here because $.state cannot be written while ui.render draws.
  on('turn.start', async ($, e, next) => {
    const active = await activePersona($)
    await update($, spinnerWordAtom, () => (active ? pickSpinner(active.persona.spinner, Math.random()) : null))
    if (active === null) await warnIfMissing($)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const word = await read($, spinnerWordAtom)
    return word ? next({ ...e, props: { ...e.props, word } }) : next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const active = await activePersona($)
    const word = active ? footerWord(active.persona.footer, e.props.durationMs) : null
    return word ? next({ ...e, props: { ...e.props, word } }) : next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'persona' }, async ($, e) => ({ text: await runCommand($, e.args) }))

  // The picker: a roster of personas beside a card for the active one, drawn in its accent color.
  // Below 60 columns the card stacks under the roster.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const registry = await read($, registryAtom)
    const settings = await getSettings($)
    const ids = Object.keys(registry.personas).sort()
    const active = settings.persona === 'off' ? null : (registry.personas[settings.persona] ?? null)
    const accent = active?.color || 'gray'
    const isNarrow = e.props.bodyColumns < 60

    const intensityRow = (
      <Box gap={1} marginTop={1}>
        {INTENSITIES.map(level => (
          <Button
            key={`intensity-${level}`}
            label={level === settings.intensity ? `[${level}]` : level}
            variant={level === settings.intensity ? 'primary' : 'secondary'}
            onPress={async () => {
              await applyIntensity($, level)
            }}
          />
        ))}
      </Box>
    )

    const roster = (
      <Box flexDirection="column" width={isNarrow ? undefined : 24} flexShrink={0}>
        {ids.map(id => {
          const persona = registry.personas[id]!
          const isActive = id === settings.persona
          return (
            <Button
              key={`persona-${id}`}
              plain
              onPress={async () => {
                await applyPersona($, id)
              }}
            >
              <Text color={persona.color || undefined} bold={isActive}>
                {isActive ? '▸ ' : '  '}●{' '}
              </Text>
              <Text bold={isActive} dimColor={!isActive}>
                {persona.name}
              </Text>
            </Button>
          )
        })}
        <Button
          key="persona-off"
          plain
          onPress={async () => {
            await applyOff($)
          }}
        >
          <Text bold={active === null} dimColor={active !== null}>
            {active === null ? '▸ ' : '  '}○ off
          </Text>
        </Button>
      </Box>
    )

    const card = active ? (
      <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1} flexGrow={1}>
        <Text bold color={accent}>
          {active.name.toUpperCase()}
        </Text>
        <Text dimColor>{active.tagline}</Text>
        {active.quote !== '' && (
          <Box marginTop={1}>
            <Text italic>
              {active.quote}
            </Text>
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text dimColor>spinner </Text>
            <Text color={accent}>{active.spinner[0] ?? 'Working'}…</Text>
          </Text>
          <Text>
            <Text dimColor>footer  </Text>
            {active.footer[0] ?? 'Baked'} for 3s
          </Text>
        </Box>
        {intensityRow}
      </Box>
    ) : (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} flexGrow={1}>
        <Text bold>
          No persona
        </Text>
        <Text dimColor>Claude replies in its normal voice. Pick a persona to give it a character.</Text>
        {intensityRow}
      </Box>
    )

    return (
      <Box flexDirection={isNarrow ? 'column' : 'row'} gap={1}>
        {roster}
        {card}
      </Box>
    )
  })
}
