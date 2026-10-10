import { expect, test } from 'claude-code/testing'

import { personaFile, world } from './world'

const ENGINE = { blocks: [{ name: 'claudeMd', text: 'engine context' }] }

test('appends the active persona as the last context block', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': personaFile('gandalf') }, store: { persona: 'gandalf', intensity: 'excessive' } })
  on('prompt.context', () => ENGINE)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks.map(b => b.name)).toEqual(['claudeMd', 'persona'])
  expect(blocks[1]?.text).toContain('gandalf voice body')
  expect(blocks[1]?.text).toContain('Active intensity: `excessive`')
  expect(blocks[1]?.text).toContain('chat replies to the user only')
  expect(blocks[1]?.text).toContain('replaces any earlier persona block')
})

test('adds nothing when the persona is off and none was announced', async ($, on) => {
  world(on, { bundled: { 'gandalf.md': personaFile('gandalf') } })
  on('prompt.context', () => ENGINE)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks.map(b => b.name)).toEqual(['claudeMd'])
})

test('a user persona overrides the bundled one with the same id', async ($, on) => {
  world(on, {
    bundled: { 'gandalf.md': personaFile('gandalf') },
    user: { 'gandalf.md': personaFile('gandalf').replace('gandalf voice body', 'user voice body') },
    store: { persona: 'gandalf' },
  })
  on('prompt.context', () => ENGINE)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks[1]?.text).toContain('user voice body')
  expect(blocks[1]?.text).not.toContain('gandalf voice body')
})

test('skips no-frontmatter files, broken symlinks and reserved ids', async ($, on) => {
  world(on, {
    bundled: { 'gandalf.md': personaFile('gandalf') },
    user: { 'yoda.md': '# Persona: Yoda\n', 'gone.md': null, 'off.md': personaFile('off') },
    store: { persona: 'yoda' },
  })
  on('prompt.context', () => ENGINE)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks.map(b => b.name)).toEqual(['claudeMd'])
})
