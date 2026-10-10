import { expect, test } from 'claude-code/testing'

import { personaFile, world } from './world'

const PANE = {
  component: 'Pane' as const,
  requestId: 'persona-picker',
  props: { title: 'Persona', isFocused: true, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 20 }, view: {} },
}

function styled(id: string): string {
  return personaFile(id).replace(`tagline: The ${id} tagline\n`, `tagline: The ${id} tagline\ncolor: "#123456"\nquote: “Hello from ${id}”\n`)
}

test('the card shows the active persona, and pressing the roster switches it', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': styled('gandalf'), 'yoda.md': styled('yoda') }, store: { persona: 'gandalf', intensity: 'excessive' } })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'persona', surface, ...PANE })
    expect(await ui.findAll({ type: 'Text', text: 'GANDALF' })).toHaveLength(2)
    expect(await ui.find({ type: 'Text', text: '(excessive)' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /Hello from gandalf/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /While working +gandalf spins/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /When done +gandalfed for 3s/ })).toBeTruthy()
    await ui.press({ key: 'persona-yoda' })
    expect(await ui.find({ type: 'Text', text: /Hello from yoda/ })).toBeTruthy()
    await ui.press({ key: 'persona-gandalf' })
    await ui.unmount()
  }
})

test('with the persona off the card casts Claude as itself', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': styled('gandalf') } })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'persona', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: '(as itself)' })).toBeTruthy()
    await ui.unmount()
  }
})

test('pressing an intensity button changes the intensity', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': styled('gandalf') }, store: { persona: 'gandalf', intensity: 'excessive' } })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const ui = await $.ui.mount({ plugin: 'persona', surface: 'terminal', ...PANE })
  await ui.press({ key: 'intensity-minimal' })
  expect(await ui.find({ key: 'intensity-minimal', text: '[minimal]' })).toBeTruthy()
  await ui.unmount()
})
