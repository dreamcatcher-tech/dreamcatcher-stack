/**
 * Returns an array of blocks that are the latest block at each path segment.
 * Updates later blocks in the array if an earlier block changes.
 * Throws if any part of the path is invalid.
 */
import { assert } from 'chai/index.mjs'
import { useState, useEffect } from 'react'
import { default as useBlockchain } from './useBlockchain'
import Debug from 'debug'
import { splitPathSegments } from '../utils'
const debug = Debug(`webdos:hooks:usePathBlockstream`)

const isChainIdMatch = (chainId, subscription) => {
  if (!subscription) {
    return false
  }
  return subscription.chainId === chainId
}
const truncateSubscriptions = (subscriptions, length) => {
  subscriptions.forEach((subscription, index) => {
    if (index >= length) {
      subscription.unsubscribe()
    }
  })
  subscriptions.length = length
}

export default (cwd) => {
  // TODO if we do not have permission to access block, throw an error
  // TODO do not push new blocks until all blocks in path are resolved
  const { blockchain, latest } = useBlockchain()
  const [blocks, setBlocks] = useState([])
  const [fetchedCwd, setFetchedCwd] = useState()
  useEffect(() => {
    let isActive = true
    setFetchedCwd(cwd)
    const segments = splitPathSegments(cwd)
    assert.strictEqual(segments[0], '/')
    debug(`segments: %o`, segments)
    const subscriptions = []
    // starting from latest, walk each segment and subscribe to changes
    const tracker = (chainId, index) => {
      if (!isActive) {
        return // TODO find cleaner way to manage bail
      }
      const shortChainId = chainId.substring(0, 9)
      debug(`tracker %s %i %s`, shortChainId, index, segments[index])
      const sub = (block) => {
        setBlocks((current) => {
          if (block !== current[index]) {
            const next = [...current]
            next[index] = block
            return next
          }
          return current
        })

        const nextIndex = index + 1
        if (nextIndex === segments.length) {
          return
        }
        const nextSegment = segments[nextIndex]
        const nextChannel = block.network.get(nextSegment)
        assert(nextChannel, `Invalid channel: ${nextSegment}`)
        assert(nextChannel.address.isResolved(), `Unresolved: ${nextSegment}`)

        const nextChainId = nextChannel.address.getChainId()
        if (!isChainIdMatch(nextChainId, subscriptions[nextIndex])) {
          truncateSubscriptions(subscriptions, nextIndex)
          setBlocks((current) => {
            current.length = nextIndex
            return current
          })
          subscriptions.push(tracker(nextChainId, nextIndex))
        }
      }
      const unsubscribe = blockchain.subscribeBlockstream(chainId, sub)
      return { chainId, unsubscribe }
    }
    const baseChainId = latest.getChainId()
    subscriptions.push(tracker(baseChainId, 0))

    return () => {
      debug(`teardown`, cwd)
      isActive = false
      subscriptions.forEach(({ unsubscribe }) => unsubscribe())
    }
  }, [blockchain, cwd])
  if (fetchedCwd === cwd) {
    return blocks
  }
  return []
}
