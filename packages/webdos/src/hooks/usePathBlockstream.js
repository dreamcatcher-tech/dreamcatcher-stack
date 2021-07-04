/**
 * Returns an array of blocks that are the latest block at each path segment.
 * Updates later blocks in the array if an earlier block changes.
 * Throws if any part of the path is invalid.
 */
import assert from 'assert'
import { useState, useEffect } from 'react'
import { useBlockchain } from './useBlockchain'
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

export const usePathBlockstream = (cwd) => {
  // TODO if we do not have permission to access block, throw an error
  const { blockchain } = useBlockchain()
  const [blocks, setBlocks] = useState()
  useEffect(() => {
    const segments = splitPathSegments(cwd)
    assert.strictEqual(segments[0], '/')
    debug(`segments: %o`, segments)
    const subscriptions = []
    // starting from latest, walk each segment and subscribe to changes
    const baseChainId = blockchain.getChainId()
    const tracker = (chainId, index) => {
      const shortChainId = chainId.substring(0, 9)
      debug(`tracker %i %i %s`, shortChainId, index, segments[index])
      const sub = (block) => {
        setBlocks((current = []) => {
          if (!block.equals(current[index])) {
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
        const nextChannel = block.network[nextSegment]
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
    subscriptions.push(tracker(baseChainId, 0))

    return () => {
      debug(`teardown`, cwd)
      subscriptions.forEach(({ unsubscribe }) => unsubscribe())
    }
  }, [blockchain, cwd])

  return blocks
}
