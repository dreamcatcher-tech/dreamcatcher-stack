const assert = require('assert')
const { lockModel, blockModel } = require('../../w015-models')
/**
 * Given a lock and a block, return a new lock with the pool reconciled,
 * as the latest block may already contain some of the interblock pool,
 * which will be removed.  Used to purge the interblock pool.
 *
 * Allows book keeping to be out of the isolation FSM.
 * Simplifies the code paths if generation isn't concerned
 * with this book keeping.
 */
const reconcile = (lock, block) =>
  lockModel.clone(lock, (draft) => {
    assert(blockModel.isModel(block))
    assert(lockModel.isModel(lock))
    draft.block = block
    const interblocks = lock.interblocks.filter((interblock) => {
      const included = block.network.includesInterblock(interblock)
      const alias = block.network.getAlias(interblock.provenance.getAddress())
      return !included && alias
    })
    draft.interblocks = interblocks
  })

module.exports = { reconcile }
