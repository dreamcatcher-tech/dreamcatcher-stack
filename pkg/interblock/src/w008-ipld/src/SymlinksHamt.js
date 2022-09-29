import { Hamt } from './Hamt'
import { Channel } from '.'
import assert from 'assert-fast'
/**
 * Symlinks are a path to path mapping.
 */
export class SymlinksHamt extends Hamt {
  async set(linkName, target) {
    assert.strictEqual(typeof linkName, 'string')
    assert.strictEqual(typeof target, 'string')
    return await super.set(linkName, target)
  }
}
