import PropTypes from 'prop-types'
import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse, api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('webdos:Complex')
const { Complex } = api
export default function ReactComplex({ engine, path, sync, wd, children }) {
  const [complex, setComplex] = useState(Complex.createLoading())
  useEffect(() => {
    if (!engine) {
      return
    }
    const iterator = engine.subscribe(path)
    debug('iterator', iterator)
    const subscribe = async () => {
      let previous = complex
      for await (const pulse of iterator) {
        debug('subscription update', pulse)
        // TODO allow skips if update takes longer than subscription interval
        const next = await previous.update(pulse, engine)
        // TODO update complex as soon as each new info is updated

        if (next !== previous) {
          debug('complex updated', next)
          setComplex((current) => next.setWd(current.wd))
          previous = next
        }
      }
    }
    subscribe()
    return () => {
      debug('teardown')
      iterator.return()
      setComplex(Complex.createLoading())
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
