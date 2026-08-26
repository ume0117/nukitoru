import { describe, it, expect } from 'vitest'
import { toggleItem, addCustomItem } from '../stock-utils'

describe('toggleItem', () => {
  it('adds a value that is not yet in the list', () => {
    expect(toggleItem(['塩'], '砂糖')).toEqual(['塩', '砂糖'])
  })

  it('removes a value that is already in the list (toggle off)', () => {
    expect(toggleItem(['塩', '砂糖'], '塩')).toEqual(['砂糖'])
  })

  it('does not mutate the input array', () => {
    const input = ['塩']
    toggleItem(input, '砂糖')
    expect(input).toEqual(['塩'])
  })
})

describe('addCustomItem', () => {
  it('adds a new trimmed value', () => {
    expect(addCustomItem(['塩'], '  自家製だし  ')).toEqual(['塩', '自家製だし'])
  })

  it('rejects an empty string', () => {
    expect(addCustomItem(['塩'], '')).toEqual(['塩'])
  })

  it('rejects a whitespace-only string', () => {
    expect(addCustomItem(['塩'], '   ')).toEqual(['塩'])
  })

  it('does not add a duplicate (exact match after trim)', () => {
    expect(addCustomItem(['塩', '砂糖'], '塩')).toEqual(['塩', '砂糖'])
    expect(addCustomItem(['塩', '砂糖'], '  塩  ')).toEqual(['塩', '砂糖'])
  })

  it('does not mutate the input array', () => {
    const input = ['塩']
    addCustomItem(input, '砂糖')
    expect(input).toEqual(['塩'])
  })
})
