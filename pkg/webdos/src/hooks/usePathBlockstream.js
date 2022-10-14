import assert from 'assert-fast'
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
  const { engine, latest } = useBlockchain()
  const [pulses, setPulses] = useState({})

  useEffect(() => {
    debug('path loaded', path)
    return () => {
      debug('path unloaded', path)
    }
  }, [path])

  useEffect(() => {
    debug('walker loaded')
    let isActive = true
    const pulses = {}
    const walker = async () => {
      // taking the latest, walk until get an error
      // once have errorred or completed, update the array of blocks we report
      const segments = splitPathSegments(path)
      debug('segments', segments)
      let partialPath = ''
      for (const segment of segments) {
        partialPath += segment
        try {
          const pulse = await engine.current(partialPath, latest)
          pulses[partialPath] = pulse
        } catch (error) {
          console.log(error.message)
          break
        }
        if (partialPath !== '/') {
          partialPath += '/'
        }
      }

      if (isActive) {
        setPulses(pulses)
      }
    }
    walker()
    return () => {
      debug('walker unloaded')
      isActive = false
    }
  }, [latest])
  return pulses
}
