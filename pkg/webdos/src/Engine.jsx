import PropTypes from 'prop-types'
import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse } from '@dreamcatcher-tech/interblock'
import toIt from 'browser-readablestream-to-it'
import Debug from 'debug'
const debug = Debug('webdos:Engine')

const shutdownMap = new Map()
export default function Engine({
  repo,
  ram,
  peers,
  addrs,
  mounts,
  init,
  actions,
  dev,
  car,
  reset,
  children,
  ...rest
}) {
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
        if (reset) {
          debug('resetting engine')
          await Interpulse.hardReset()
          debug('reset complete')
        }
        const overloads = dev
        engine = await Interpulse.create({ ram, repo, overloads })
        globalThis.interpulse = engine
        console.info('starting engine', repo)
        setEngine(engine)
        debug(`Engine ready`)
        if (car) {
          const { url, path } = car
          debug('importing car from %s to %s', url, path)
          try {
            const response = await fetch(url)
            const stream = toIt(response.body)
            const { roots, count } = await engine.import(stream)
            debug('imported %i pulses with root:', count, roots[0])
            await engine.insert(roots[0].cid.toString(), path)
            debug('import complete to path:', path)
          } catch (error) {
            debug('import failed', error)
            !debug.enabled && console.error(error)
          }
        }
        if (init && engine.isCreated) {
          debug('init', init)
          for (const action of init) {
            assert.strictEqual(Object.keys(action).length, 1)
            const command = Object.keys(action).pop()
            const args = Object.values(action).pop()
            debug('execute', command)
            await engine.execute(command, args)
            debug('execute done', command)
          }
          debug('init complete')
        }
        if (actions) {
          debug('actions', actions)
          for (const action of actions) {
            assert.strictEqual(Object.keys(action).length, 1)
            const command = Object.keys(action).pop()
            const args = Object.values(action).pop()
            debug('execute', command)
            // TODO use in build init function in engine
            await engine.execute(command, args)
            debug('execute done', command)
          }
        }
        if (addrs) {
          debug('addrs', addrs)
          for (const multiaddr of addrs) {
            const result = await engine.multiaddr(multiaddr)
            debug('addrs result', result)
          }
          debug('addrs added')
        }
        if (peers) {
          debug('peers', peers)
          let mtab
          try {
            mtab = await engine.current('/.mtab')
          } catch (error) {
            debug('mtab error:', error.message)
          }
          if (mtab) {
            const state = mtab.getState().toJS()
            debug('mtab state', state)
          }
          for (const [chainId, peerId] of Object.entries(peers)) {
            const result = await engine.peer(chainId, peerId)
            debug('peer result', result)
          }
          debug('peers connected')
        }
        if (mounts) {
          debug('mounts', mounts)
          for (const [name, chainId] of Object.entries(mounts)) {
            let exists
            try {
              exists = await engine.current('./mtab/' + name)
            } catch (error) {
              debug('mount error:', error.message)
            }
            if (!exists) {
              const result = await engine.mount(name, chainId)
              debug('mount result', result)
            } else {
              debug('mount exists', name, chainId)
            }
          }
          debug('mounts complete')
        }
      }
      const stop = async () => {
        debug('stopping', repo)
        params.isStopped = true
        delete globalThis.interpulse
        console.info('shutting down engine', repo)
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
          debug('subscription update', params)
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

  const props = { engine, latest, state, wd, isPending, ...rest }
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
  peers: PropTypes.objectOf(PropTypes.string),

  /**
   * Array of multiaddresses to use.  Each one has a peerId included.
   */
  addrs: PropTypes.arrayOf(PropTypes.string),

  /**
   * Map of paths in mtab to chainIds to mount at that path.
   */
  mounts: PropTypes.objectOf(PropTypes.string),

  /**
   * Map of covenant paths to reified covenants that will be replaced by this
   * engine.
   */
  dev: PropTypes.object,

  /**
   * A list of operations that will be applied to the engine on its first
   * boot. Each object in the array takes the form: { path/apiCall, args }.
   * To run multiple actions in parallel, supply many keys.
   */
  init: PropTypes.arrayOf(PropTypes.object),

  /**
   * A list of operations that will be applied to the engine on mount.
   * Each object in the array takes the form: { path/apiCall, args }.
   * To run multiple actions in parallel, supply many keys.
   */
  actions: PropTypes.arrayOf(PropTypes.object),

  /**
   * When the engine mounts, should it be reset to its initial state?
   * This will cause any actions in `init` to be executed after reset.
   */
  reset: PropTypes.bool,

  /**
   * URL of the car file to load into the engine at the given path.
   */
  car: PropTypes.exact({ url: PropTypes.string, path: PropTypes.string }),

  /**
   * Should be a list of <Complex/> components.
   * Each child will be cloned, and have its `engine` prop set to the engine
   */
  children: PropTypes.node,
}
