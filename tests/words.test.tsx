import { expect, test } from 'claude-code/testing'

import { footerWord, pickSpinner } from '../hooks/words'
import { personaFile, world } from './world'

const SPINNER = {
  surface: 'terminal' as const,
  component: 'Spinner' as const,
  requestId: 'spin',
  props: { word: 'Baking', message: null, suffix: '…', mode: 'thinking' as const },
}
const FOOTER = {
  surface: 'terminal' as const,
  component: 'TurnDuration' as const,
  requestId: 'foot',
  props: { word: 'Baked', durationMs: 3000 },
}

test('pickSpinner maps a random number onto the list', () => {
  expect(pickSpinner(['a', 'b', 'c'], 0)).toBe('a')
  expect(pickSpinner(['a', 'b', 'c'], 0.99)).toBe('c')
  expect(pickSpinner([], 0.5)).toBe(null)
})

test('footerWord is stable for one duration', () => {
  expect(footerWord(['a', 'b', 'c'], 4)).toBe('b')
  expect(footerWord(['a', 'b', 'c'], 4)).toBe('b')
  expect(footerWord([], 4)).toBe(null)
})

test('spinner and footer draw persona words and the status line names the persona', async ($, on) => {
  const log = world(on, { bundled: { 'gandalf.md': personaFile('gandalf') }, store: { persona: 'gandalf', intensity: 'noticeable' } })
  const drawn: string[] = []
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    drawn.push(e.props.word)
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.word}</Text>
  })
  on('ui.render', { component: 'TurnDuration' }, ($, e) => {
    drawn.push(e.props.word)
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.word}</Text>
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.render(SPINNER)
  await $.ui.render(FOOTER)
  expect(drawn).toEqual(['gandalf spins', 'gandalfed'])
  expect(log.statuses.at(-1)).toBe('gandalf · noticeable')
})

test('with the persona off the engine words pass through and the status is cleared', async ($, on) => {
  const log = world(on, { bundled: { 'gandalf.md': personaFile('gandalf') } })
  const drawn: string[] = []
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    drawn.push(e.props.word)
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.word}</Text>
  })
  on('ui.render', { component: 'TurnDuration' }, ($, e) => {
    drawn.push(e.props.word)
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.word}</Text>
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.ui.render(SPINNER)
  await $.ui.render(FOOTER)
  expect(drawn).toEqual(['Baking', 'Baked'])
  expect(log.statuses.at(-1)).toBe(undefined)
})

test('a stored persona missing from the registry toasts once', async ($, on) => {
  const log = world(on, { bundled: { 'gandalf.md': personaFile('gandalf') }, store: { persona: 'ghost' } })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await $.turn.start({ text: 'a', turnId: 't1' })
  await $.turn.start({ text: 'b', turnId: 't2' })
  expect(log.toasts).toEqual(['persona: "ghost" not found; running without a persona. Try /persona reload.'])
})
