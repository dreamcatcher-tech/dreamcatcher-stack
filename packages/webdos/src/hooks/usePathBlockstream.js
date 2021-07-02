/**
 * Used to subscribe directly to the blocks of a given chain.
 * Contrasts to useChannel which offers a lightweight view into a chain
 * for reading limited data, and sending actions in.
 *
 * useBlockstream pulls in the entire block, and fires every time a new block is created.
 * Uses the binary layer to access these blocks.
 * Uses the same underlying methods that the stdengine would apply if the same
 * commands were called from inside a chain.
 *
 * If there is no path or we have no permissions, it returns `undefined` and
 * continues to try.
 */
import assert from 'assert'
import { useState, useEffect } from 'react'
import { useBlockchain } from './useBlockchain'
import Debug from 'debug'
import { getPathSegments } from '../utils'
const debug = Debug(`terminal:useBlockstream`)

export const useBlockstream = (cwd, slice) => {
  // slice is some subpath in the state that we are interested in
  // TODO if we do not have permission to access block, throw an error
  const { blockchain, latest } = useBlockchain()
  const [block, setBlock] = useState()
  const [currentCwd, setCwd] = useState()
  useEffect(() => {
    const segments = getPathSegments(cwd)
    let active = true
    let unsubscribe = () => (active = false)
    let short
    const subscribe = async () => {
      let partialPath = segments.shift()
      let nextBlock = latest
      let chainId = latest.getChainId()
      while (partialPath !== cwd) {
        partialPath = segments.shift()
        const alias = partialPath.split('/').pop()
        debug(`alias %s`, alias)
        assert(nextBlock.network[alias].address.isResolved())
        chainId = nextBlock.network[alias].address.getChainId()
        if (partialPath !== cwd) {
          nextBlock = await blockchain.getLatest(chainId)
          if (!active) {
            return
          }
        }
      }
      short = chainId.substring(0, 9)
      debug(`subscribe %s %s`, cwd, short)
      unsubscribe = blockchain.subscribeBlockstream(chainId, (nextBlock) => {
        if (block && !block.isNext(nextBlock)) {
          return
        }
        debug(`setting block`, cwd, short, nextBlock.getHeight())
        setBlock(nextBlock)
      })
    }
    subscribe()
    return () => {
      debug(`teardown`, cwd, short)
      unsubscribe()
    }
  }, [blockchain, latest, block, cwd, slice]) // TODO rationalize dependencies
  if (cwd !== currentCwd) {
    setBlock()
    setCwd(cwd)
    return
  }
  return block
}
