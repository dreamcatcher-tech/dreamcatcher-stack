import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
import { useEffect, useState } from 'react'
import { useBlockstream } from '.'

const debug = Debug(`terminal:useBlockstream`)
export default (path, masks = []) => {
  assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
  const pulse = useBlockstream(path)
  // TODO use immutable for large child lists
  const [children, setChildrenRaw] = useState({})
  const setChildren = (buffer) => {
    const ordered = {}
    const keys = Object.keys(buffer)
    keys.sort((a, b) => {
      const aId = buffer[a].channelId
      const bId = buffer[b].channelId
      return aId - bId
    })
    keys.forEach((key) => (ordered[key] = buffer[key]))
    setChildrenRaw(ordered)
  }
  useEffect(() => {
    let isActive = true
    const walker = async () => {
      const buffer = {}
      const network = pulse.getNetwork()
      const childrenHamt = network.children
      for await (const [alias, channelId] of childrenHamt.entries()) {
        const channel = await network.channels.getChannel(channelId)
        if (masks.includes(alias)) {
          continue
        }
        buffer[alias] = getChannelParams(channel)
        if (!isActive) {
          return
        }
        if (!children[alias]) {
          setChildren(buffer)
        }
      }
      if (pulse.provenance.dmz.config.isPierced && !masks.includes('.@@io')) {
        const io = await network.getIo()
        buffer['.@@io'] = getChannelParams(io)
      }
      if (!isActive) {
        return
      }
      setChildren(buffer)
    }
    if (pulse) {
      walker()
    }

    return () => {
      isActive = false
    }
  }, [pulse])
  return children
}

const getChannelParams = (channel) => {
  const { address, rx, tx, channelId } = channel
  const chainId = address.isResolved()
    ? address.getChainId()
    : address.toString()
  const params = { chainId, channelId }
  if (rx.tip) {
    params.tip = rx.tip.toString()
  }
  if (tx.precedent) {
    params.precedent = tx.precedent.toString()
  }
  return params
}
