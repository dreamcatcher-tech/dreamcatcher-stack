import PropTypes from 'prop-types'
import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse, api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('webdos:Complex')
const { Complex } = api
export default function ReactComplex({ engine, path, sync, wd, children }) {
  const [complex, setComplex] = useState(Complex.create({ isLoading: true }))
  useEffect(() => {
    if (!engine) {
      return
    }
    const iterator = engine.subscribe(path)
    debug('iterator', iterator)
    let previous
    const subscribe = async () => {
      for await (const latest of iterator) {
        debug('subscription update', latest)
        if (previous) {
          const previousState = previous.getState()
          const latestState = latest.getState()
          if (previousState.cid.equals(latestState.cid)) {
            debug('no state change')
            continue
          }
        }
        // make the process of syncing diffs be the same as syncing all

        // load the actions for this pulse

        if (sync) {
          // check which children are different
          // what was added
          // what was removed
          // only permit one sync to be in progress at any time
        }

        previous = latest
        setComplex((current) => current.setState(latest.getState().toJS()))
      }
    }
    subscribe()
    return () => {
      iterator.return()
    }
  }, [path, engine])
  if (wd !== complex.wd) {
    setComplex((current) => current.setWd(wd))
  }
  children = React.cloneElement(children, { complex })
  return children
}
ReactComplex.propTypes = {
  /**
   * The Interpulse engine
   */
  engine: PropTypes.instanceOf(Interpulse),
  /**
   * What path is the root of this Complex ?
   */
  path: PropTypes.string.isRequired,
  /**
   * Should a full sync be maintained for the tree at this path ?
   */
  sync: PropTypes.bool,
  /**
   * What is the current working directory ?
   */
  wd: PropTypes.string,
}
