import { describe, expect, test } from 'claude-code/testing'

import { parseFrontmatter, parsePersona } from '../hooks/frontmatter'
import { personaFile } from './world'

describe('parsePersona', () => {
  test('reads scalars, lists and the body', () => {
    expect(parsePersona(personaFile('gandalf'), 'bundled')).toEqual({
      persona: {
        id: 'gandalf',
        name: 'GANDALF',
        tagline: 'The gandalf tagline',
        color: '',
        quote: '',
        spinner: ['gandalf spins'],
        footer: ['gandalfed'],
        body: '## Voice Guide\ngandalf voice body',
        source: 'bundled',
      },
    })
  })

  test('rejects a file with no frontmatter', () => {
    expect(parsePersona('# Persona: Gandalf\n\n> tagline\n', 'user')).toEqual({ error: 'no frontmatter' })
  })

  test('rejects a missing or invalid id', () => {
    expect(parsePersona('---\nname: X\n---\nbody\n', 'user')).toEqual({ error: 'missing or invalid id' })
    expect(parsePersona('---\nid: Bad Id\nname: X\n---\nbody\n', 'user')).toEqual({ error: 'missing or invalid id' })
  })

  test('rejects a missing name', () => {
    expect(parsePersona('---\nid: x\n---\nbody\n', 'user')).toEqual({ error: 'missing name' })
  })

  test('missing spinner and footer become empty lists', () => {
    expect(parsePersona('---\nid: x\nname: X\n---\nbody\n', 'user')).toEqual({
      persona: { id: 'x', name: 'X', tagline: '', color: '', quote: '', spinner: [], footer: [], body: 'body', source: 'user' },
    })
  })
})

describe('parsePersona display fields', () => {
  test('reads color and quote', () => {
    const result = parsePersona('---\nid: x\nname: X\ncolor: "#A0522D"\nquote: \u201cHello.\u201d [aside]\n---\nbody\n', 'user')
    expect(result).toMatchObject({ persona: { color: '#A0522D', quote: '\u201cHello.\u201d [aside]' } })
  })
})

describe('parseFrontmatter', () => {
  test('unquotes values and keeps colons inside values', () => {
    expect(parseFrontmatter('tagline: "Fly: you fools"\nspinner:\n  - \'A: b\'')).toEqual({
      tagline: 'Fly: you fools',
      spinner: ['A: b'],
    })
  })
})
