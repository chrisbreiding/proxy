import {
  describe,
  it,
  expect,
  vi,
} from 'vitest'

import { clone, compact, mapPromisesSerially } from '../../../lib/util/collections'

describe('lib/util/collections', () => {
  describe('#clone', () => {
    it('clones the object', () => {
      const original = { a: 'value' }

      expect(clone(original)).not.to.equal(original)
    })

    it('clones deep properties of the object', () => {
      const original = { a: { b: { c: 'value' } } }

      expect(clone(original).a.b).not.to.equal(original.a.b)
    })
  })

  describe('#compact', () => {
    it('removes falsy values from array', () => {
      const original = [1, undefined, 'a', undefined, false, 0, null, NaN, '', true, {}]

      expect(compact(original)).to.deep.equal([1, 'a', true, {}])
    })

    it('does not mutate array', () => {
      const original = [1, undefined, 'a', undefined, false, 0, null, NaN, '', true, {}]

      expect(compact(original)).not.to.equal(original)
    })
  })

  describe('#mapPromisesSerially', () => {
    it('runs function with each item in the array', async () => {
      const fns = [vi.fn(), vi.fn(), vi.fn()]

      await mapPromisesSerially([0, 1, 2], (index) => {
        return fns[index](index)
      })

      expect(fns[0]).toBeCalledWith(0)
      expect(fns[1]).toBeCalledWith(1)
      expect(fns[2]).toBeCalledWith(2)
    })

    it('returns an array of the resolved values', async () => {
      const result = await mapPromisesSerially([1, 2, 3], (num) => {
        return Promise.resolve(`#${num}`)
      })

      expect(result).to.deep.equal(['#1', '#2', '#3'])
    })

    it('runs the function serially', async () => {
      const fn1 = vi.fn().mockReturnValue(() => {
        return Promise.resolve().then(() => {
          expect(fn2).not.toBeCalled
        })
      })
      const fn2 = vi.fn().mockReturnValue(() => {
        return Promise.resolve().then(() => {
          expect(fn3).not.toBeCalled
        })
      })
      const fn3 = vi.fn().mockReturnValue(() => {
        return Promise.resolve()
      })

      const fns = [fn1, fn2, fn3]

      await mapPromisesSerially([0, 1, 2], (index) => {
        return fns[index](index)
      })
    })
  })
})
