import delay from 'delay'
import PropTypes from 'prop-types'
import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('webdos:Engine')

const shutdownMap = new Map()
export default function Engine({ repo, ram, init, dev, children }) {
  if (ram) {
    repo = undefined
  }
  const [latest, setLatest] = useState()
  const [state, setState] = useState({})
  const [wd, setWd] = useState('/')
  const [engine, setEngine] = useState()
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    const start = () => {
      let engine
      const asyncStart = async () => {
        const engineStop = shutdownMap.get(repo)
        debug(`Starting engine`, engineStop)
        if (engineStop) {
          debug(`Engine already running, awaiting stop`)
          await engineStop
          debug('previous engine has stopped')
        }
        const overloads = dev
        engine = await Interpulse.createCI({ repo, overloads })
        globalThis.interpulse = engine
        setEngine(engine)
        debug(`Engine ready`)
        if (init && engine.isCreated) {
          debug('init', init)
          for (const action of init) {
            assert.strictEqual(Object.keys(action).length, 1)
            const command = Object.keys(action).pop()
            const args = Object.values(action).pop()
            await engine[command](args)
          }
          debug('init complete')
        }
      }
      const stop = async () => {
        debug('stopping', repo)
        params.isStopped = true
        delete globalThis.interpulse
        setEngine()
        await awaitStart
        await engine.stop()
        shutdownMap.delete(repo)
        debug('stopped', repo)
      }
      const awaitStart = asyncStart()
      const subscribe = async () => {
        await awaitStart
        for await (const latest of engine.subscribe('/')) {
          debug('subscription update')
          assert(!params.isStopped, 'awaitStop already set')
          if (params.isStopped) {
            return
          }
          assert(latest)
          setLatest(latest)
          const state = latest.getState().toJS()
          setState(state)
          const { wd = '/' } = state
          setWd(wd)
        }
      }
      subscribe()
      const params = { awaitStart, stop }
      return params
    }
    const engineParams = start()
    debug('starting', engineParams)
    return () => {
      debug('effect cleanup triggered', repo)
      assert(!shutdownMap.has(repo), 'awaitStop already set')
      shutdownMap.set(repo, engineParams.stop())
      debug('effect cleanup complete', repo)
    }
  }, [])

  const props = { engine, latest, state, wd, isPending }
  children = React.cloneElement(children, props)
  return children
}

Engine.propTypes = {
  /**
   * Name of the repo to use, which will be used to name the indexDb instance.
   * If `ram` is true, this prop is ignored.
   */
  repo: PropTypes.string,
  /**
   * Should the engine be run in RAM only?
   */
  ram: PropTypes.bool,
  /**
   * Map of chainIds to arrays of peerIds.
   *
   */
  peers: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)),
  /**
   * Map of peerIds to arrays of multiaddresses.
   * Each multiaddress has the peerId removed from it.   *
   */
  addrs: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)),
  /**
   * Map of covenant paths to reified covenants that will be replaced by this
   * engine.
   */
  dev: PropTypes.object,
  /**
   * A list of operations that will be applied to the engine on its first
   * boot. Each object in the array takes the form: { path/apiCall, args }
   */
  init: PropTypes.arrayOf(PropTypes.object),
  /**
   * When the engine mounts, should it be reset to its initial state?
   * This will cause any actions in `init` to be executed after reset.
   */
  reset: PropTypes.bool,
  /**
   * Should be a list of <Complex/> components.
   * Each child will be cloned, and have its `engine` prop set to the engine
   */
  children: PropTypes.node,
}
