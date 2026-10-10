import { expect, test } from 'claude-code/testing'

import { personaFile, runPersona, world } from './world'

const IDS = ['attenborough', 'bob-ross', 'chewbacca', 'gandalf', 'monty-python', 'mr-rogers', 'picard', 'princess-bride', 'rocky', 'ron-swanson', 'sauron', 'spock', 'the-dude', 'yoda']

test('the doctor report loads all 14 bundled personas', async ($, on) => {
  const bundled: Record<string, string> = {}
  for (const id of IDS) bundled[`${id}.md`] = personaFile(id)
  world(on, { bundled })
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const result = await runPersona($, 'doctor')
  for (const id of IDS) expect(result.text).toContain(`  ${id} (bundled)`)
})
