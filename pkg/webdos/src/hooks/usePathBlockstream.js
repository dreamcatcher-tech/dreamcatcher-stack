import equals from 'fast-deep-equal'
import { useState, useEffect } from 'react'
import { default as useBlockchain } from './useBlockchain'
import Debug from 'debug'
import { splitPathSegments } from '../utils'
const debug = Debug(`webdos:hooks:usePathBlockstream`)
/**
 * Returns an array of blocks that are the latest block at each path segment.
 * Updates later blocks in the array if an earlier block changes.
 * Throws if any part of the path is invalid.
 */
export default (path) => {
  const { engine } = useBlockchain()
  const [pulses, setPulses] = useState({})

  useEffect(() => {
    debug('path loaded', path)
    return () => {
      debug('path unloaded', path)
    }
  }, [path])

  useEffect(() => {
    debug('walker loaded')
    // TODO WARNING must use subscribe to start up to date
    let isActive = true
    const nextPulses = {}
    const walker = async () => {
      const segments = splitPathSegments(path)
      debug('segments', segments)
      let partialPath = ''
      for (const segment of segments) {
        partialPath += segment
        try {
          const pulse = await engine.current(partialPath)
          nextPulses[partialPath] = pulse
        } catch (error) {
          console.log(error.message)
          break
        }
        if (partialPath !== '/') {
          partialPath += '/'
        }
      }

      if (isActive && !equals(pulses, nextPulses)) {
        setPulses(nextPulses)
      }
    }
    walker()
    return () => {
      debug('walker unloaded')
      isActive = false
    }
  }, [path])
  return pulses
}
