/**
 * Purpose of the readers is to read from the blocks of other chains
 * and insert those results back in to the executing current block.
 */
const debug = require('debug')('interblock:api:readers')
const LATEST = -1

const useBlocks = async (path, height, count) => {
  debug(`useBlocks`, path, height, count)
  // TODO incorporate the root chain check to ensure consistency
  if (typeof path !== 'string') {
    throw new Error(`path or chainId must be provided`)
  }
  if (typeof height !== 'undefined' && !Number.isInteger(height)) {
    throw new Error(`Height must be a whole number, but was ${typeof height}`)
  } else {
    if (height < 0 && height !== LATEST) {
      throw new Error(`Height cannot be less than -1: ${height}`)
    }
  }
  if (typeof count !== 'undefined' && !Number.isInteger(count)) {
    if (count <= 0) {
      throw new Error(`count must be greater than zero: ${count}`)
    }
  }
  return _useBlocks(path, height, count)
}
const _useBlocks = (path, height, count) => {
  // ? how to communicate with the block producer ?
  // BP must loop and do path walking, as cannot be stored in the block itself
  // ? need another kind of hook - a system hook ?
  // ? use inband effect with special action
  // use special class of hooks ?
}

module.exports = { useBlocks }
