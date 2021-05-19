const assert = require('assert')
const posix = require('path')
const { blockModel } = require('../../../w015-models')
const debug = require('debug')('interblock:query')
const { toFunctions } = require('./consistencyFactory')
const queryFactory = (ioConsistency, block) => {
  assert(blockModel.isModel(block))
  let isQueryEnabled = true
  const consistency = toFunctions(ioConsistency)
  const query = (query) => {
    // TODO turn into a queryModel object
    debug(`query: `, query)
    if (!isQueryEnabled) {
      throw new Error(`query attempted after execution: ${query.type}`)
    }
    const { type, payload } = query
    switch (type) {
      case '@@USE_BLOCKS':
        const { path, height, count } = payload
        return useBlocks(path, height, count)
      default:
        throw new Error(`Unknown query: ${type}`)
    }
  }
  const disable = () => (isQueryEnabled = false)
  const useBlocks = async (path, height, count) => {
    // TODO discover the absolute path from partial path
    // TODO implement height and count parameters
    assert.strictEqual(typeof path, 'string')
    assert(posix.isAbsolute(path))
    assert(Number.isInteger(height))
    assert(height >= -1)
    assert(Number.isInteger(count))
    assert(count > 0)

    debug(`@@USE_BLOCKS`, path, height, count)
    let parentBlock = block
    while (!parentBlock.network.getParent().address.isRoot()) {
      debug(`loop`)
      const channel = parentBlock.network.getParent()
      const { address, lineageHeight: height } = channel
      parentBlock = await consistency.getBlock({ address, height })
    }
    if (path === '/') {
      return parentBlock // TODO honour height and count params
    }
    // TODO cache queries for the same block and height using a weakmap
    // start the walk downwards
    const children = path.substring(1).split('/')
    debug(`children`, children)
    let subpath = ''
    let childBlock = parentBlock
    for (const child of children) {
      subpath += '/' + child
      if (!childBlock.network[child]) {
        throw new Error(`Non existent path: ${subpath}`)
      }
      const { address, lineageHeight: height } = childBlock.network[child]
      childBlock = await consistency.getBlock({ address, height })
      debug(`fetched ${subpath} at height: ${height}`)
    }
    return childBlock // TODO honour height and count params
  }
  return { query, disable }
}

module.exports = { queryFactory }
