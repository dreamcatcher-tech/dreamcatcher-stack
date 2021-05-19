/**
 * Purpose of the readers is to read from the blocks of other chains
 * and insert those results back in to the executing current block.
 */
const debug = require('debug')('interblock:api:queries')
const { query } = require('./hooks')
const useFind = (pathPattern, query) => {
  // find within the json data, treating mathing paths as a collection
}
const useFindBinary = (pathPattern, query) => {
  // search within the binary of different objects
}

const LATEST = -1
const ALL = Number.MAX_SAFE_INTEGER

/**
 * ? Return just the hash of the blocks to fetch ?
 * With no args, will return the last known block of this chain.
 * Note that asking for the next block has no meaning, as the current block
 * is a matter of perspective.  To get the next block from a current perspective,
 * you must get the latest known block and then ask for the next one after that.
 * @param {*} path
 * @param {*} height
 * @param {*} count
 * @param {*} slice some path within the block
 * @returns
 */
const useBlocks = async (path = '.', height = LATEST, count = 1, slice) => {
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
  // BP must loop and do path walking, as cannot be stored in the block itself
  debug(`useBlocks`, path, height, count)

  // not same as effectInBand
  // effectInBand should change to being resolvable
  // effects should change to being able to be resolvable potentially

  return query('@@USE_BLOCKS', { path, height, count })
}

/**
 * No args gets the current binary
 * @param {*} path
 * @param {*} height
 * @param {*} rangeStart
 * @param {*} rangeEnd
 */
const useBinary = async (path, height, start, length) => {}

const setBinary = async (buffer, path) => {}
/**
 * No binary prior will create one
 * @param {*} buffer
 * @param {*} path
 * @param {*} start
 * @param {*} length
 */
const updateBinary = async (buffer, path, start, length) => {}
const deleteBinary = async (path) => {}
module.exports = {
  useFind,
  useFindBinary,
  useBlocks,
  useBinary,
  setBinary,
  updateBinary,
  deleteBinary,
  LATEST,
  ALL,
}
