import { describe, expect, test } from 'claude-code/testing'

import { parseArgs } from '../hooks/command'
import { HOME, personaFile, runPersona, submit, world } from './world'

const BUNDLED = {
  'gandalf.md': personaFile('gandalf'),
  'yoda.md': personaFile('yoda'),
  '_template.md': '---\nid: {{id}}\nname: {{id}}\n---\n\n## Voice Guide\n',
}

describe('parseArgs', () => {
  test('maps each form to an action', () => {
    expect(parseArgs('')).toEqual({ kind: 'picker' })
    expect(parseArgs('off')).toEqual({ kind: 'off' })
    expect(parseArgs('doctor')).toEqual({ kind: 'doctor' })
    expect(parseArgs('reload')).toEqual({ kind: 'reload' })
    expect(parseArgs('create bilbo')).toEqual({ kind: 'create', id: 'bilbo' })
    expect(parseArgs('yoda')).toEqual({ kind: 'set', id: 'yoda' })
    expect(parseArgs('yoda excessive')).toEqual({ kind: 'set', id: 'yoda', intensity: 'excessive' })
  })

  test('rejects bad intensity, bad create ids and extra words', () => {
    expect(parseArgs('yoda loud')).toEqual({ kind: 'error', text: 'Unknown intensity "loud". Valid: minimal, noticeable, excessive.' })
    expect(parseArgs('create Bad!')).toEqual({ kind: 'error', text: 'Usage: /persona create <id> (lowercase letters, digits and dashes).' })
    expect(parseArgs('a b c')).toMatchObject({ kind: 'error' })
  })
})

test('/persona <id> <intensity> switches the persona sent with the next prompt', async ($, on) => {
  const log = world(on, { bundled: BUNDLED, store: { persona: 'gandalf', intensity: 'noticeable' } })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context ?? [] }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await runPersona($, 'yoda excessive')
  expect(result.text).toBe('Persona set to yoda (excessive).')
  const sent = await submit($, 'next')
  expect(sent.context?.[0]).toContain('yoda voice body')
  expect(log.statuses.at(-1)).toBe('yoda · excessive')
  expect(log.toasts.at(-1)).toBe('YODA: The yoda tagline')
})

test('/persona <unknown> lists the valid ids and changes nothing', async ($, on) => {
  world(on, { bundled: BUNDLED, store: { persona: 'gandalf' } })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context ?? [] }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await runPersona($, 'sauron')
  expect(result.text).toBe('Unknown persona "sauron". Valid: gandalf, yoda, off.')
  const sent = await submit($, 'next')
  expect(sent.context?.[0]).toContain('gandalf voice body')
})

test('/persona off sends a cancelling block and clears the status', async ($, on) => {
  const log = world(on, { bundled: BUNDLED, store: { persona: 'gandalf' } })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context ?? [] }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await submit($, 'hi')
  expect((await runPersona($, 'off')).text).toBe('Persona off.')
  const sent = await submit($, 'next')
  expect(sent.context?.[0]).toContain('Persona is off.')
  expect(log.statuses.at(-1)).toBe(undefined)
})

test('/persona create writes from the template and refuses an existing file', async ($, on) => {
  const log = world(on, { bundled: BUNDLED, user: { 'yoda.md': personaFile('yoda') } })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const created = await runPersona($, 'create bilbo')
  expect(created.text).toBe(`Created ${HOME}/.claude/personas/bilbo.md. Fill it in, then run /persona reload.`)
  expect(log.writes[`${HOME}/.claude/personas/bilbo.md`]).toContain('id: bilbo')
  const refused = await runPersona($, 'create yoda')
  expect(refused.text).toBe(`${HOME}/.claude/personas/yoda.md already exists; not overwriting.`)
})

test('/persona doctor lists sources and skipped files', async ($, on) => {
  world(on, { bundled: BUNDLED, user: { 'gone.md': null, 'off.md': personaFile('off') } })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await runPersona($, 'doctor')
  expect(result.text).toContain('gandalf (bundled)')
  expect(result.text).toContain(`${HOME}/.claude/personas/gone.md: broken symlink`)
  expect(result.text).toContain(`${HOME}/.claude/personas/off.md: reserved id "off"`)
})

test('/persona with no pane surface prints the list', async ($, on) => {
  world(on, { bundled: BUNDLED, store: { persona: 'yoda' } })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await runPersona($, '')
  expect(result.text).toContain('▸ yoda — YODA: The yoda tagline (bundled)')
  expect(result.text).toContain('Usage: /persona')
})

test('pressing a persona in the picker pane switches to it', async ($, on) => {
  world(on, { bundled: BUNDLED, store: { persona: 'gandalf' } })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context ?? [] }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'persona',
      surface,
      component: 'Pane',
      requestId: 'persona-picker',
      props: { title: 'Persona', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
    })
    await ui.press({ key: 'persona-yoda' })
    const sent = await submit($, 'next')
    expect(sent.context?.[0]).toContain('yoda voice body')
    await ui.press({ key: 'persona-gandalf' })
    await submit($, 'back to gandalf')
    await ui.unmount()
  }
})
