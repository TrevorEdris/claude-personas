import { expect, test } from 'claude-code/testing'

import { personaFile, runPersona, submit, world } from './world'

// Stands for the engine beneath the plugins: the prompt enters with whatever context reached it.
function engine(on: Parameters<typeof world>[0]): void {
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context ?? [] }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
}

test('the first prompt carries the active persona block, later prompts do not', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': personaFile('gandalf') }, store: { persona: 'gandalf', intensity: 'excessive' } })
  engine(on)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const first = await submit($, 'hi')
  expect(first.context?.length).toBe(1)
  expect(first.context?.[0]).toContain('gandalf voice body')
  expect(first.context?.[0]).toContain('Active intensity: `excessive`')
  expect(first.context?.[0]).toContain('chat replies to the user only')
  expect(first.context?.[0]).toContain('replaces any earlier persona block')
  const second = await submit($, 'again')
  expect(second.context ?? []).toEqual([])
})

test('nothing is attached while the persona is off and none was sent', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': personaFile('gandalf') } })
  engine(on)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await submit($, 'hi')
  expect(result.context ?? []).toEqual([])
})

test('a switch re-sends the block on the next prompt, and off sends one cancelling block', async ($, on) => {
  world(on, {
    bundled: { 'gandalf.md': personaFile('gandalf'), 'yoda.md': personaFile('yoda') },
    store: { persona: 'gandalf' },
  })
  engine(on)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await submit($, 'hi')
  await runPersona($, 'yoda')
  const afterSwitch = await submit($, 'and now?')
  expect(afterSwitch.context?.[0]).toContain('yoda voice body')
  await runPersona($, 'off')
  const afterOff = await submit($, 'plain please')
  expect(afterOff.context?.[0]).toContain('Persona is off.')
  const later = await submit($, 'still plain')
  expect(later.context ?? []).toEqual([])
})

test('a compaction makes the next prompt carry the block again', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': personaFile('gandalf') }, store: { persona: 'gandalf' } })
  engine(on)
  on('session.compact', () => ({ messages: [{ role: 'user' as const, text: 'summary', toolUses: [] }] }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await submit($, 'hi')
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  const next = await submit($, 'after compaction')
  expect(next.context?.[0]).toContain('gandalf voice body')
})

test('a user persona overrides the bundled one with the same id', async ($, on) => {
  world(on, {
    bundled: { 'gandalf.md': personaFile('gandalf') },
    user: { 'gandalf.md': personaFile('gandalf').replace('gandalf voice body', 'user voice body') },
    store: { persona: 'gandalf' },
  })
  engine(on)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await submit($, 'hi')
  expect(result.context?.[0]).toContain('user voice body')
  expect(result.context?.[0]).not.toContain('gandalf voice body')
})

test('skips no-frontmatter files, broken symlinks and reserved ids', async ($, on) => {
  world(on, {
    bundled: { 'gandalf.md': personaFile('gandalf') },
    user: { 'yoda.md': '# Persona: Yoda\n', 'gone.md': null, 'off.md': personaFile('off') },
    store: { persona: 'yoda' },
  })
  engine(on)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await submit($, 'hi')
  expect(result.context ?? []).toEqual([])
})
