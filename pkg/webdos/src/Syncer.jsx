import PropTypes from 'prop-types'
import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse, Syncer, Crisp } from '@dreamcatcher-tech/interblock'
import each from 'it-foreach'
import drain from 'it-drain'
import Debug from 'debug'
import posix from 'path-browserify'

const debug = Debug('webdos:Syncer')

export default function ReactSyncer({ engine, path, children }) {
  assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
  path = stripTrailingSlash(path)
  const [crisp, setCrisp] = useState(Crisp.createLoading())
  assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
  useEffect(() => {
    if (!engine) {
      return
    }
    const { pulseResolver, covenantResolver, api } = engine
    const syncer = Syncer.create(pulseResolver, covenantResolver, api, path)
    const wdIterator = engine.subscribe('/')
    const pathIterator = engine.subscribe(path)
    const crispIterator = syncer.subscribe()

    debug('iterators', wdIterator, pathIterator, crispIterator)

    const wdDrain = each(wdIterator, () => {
      setCrisp((current) => {
        debug('wd update crisp was: %s wd is: %s', current.wd, engine.wd)
        if (!engine.wd.startsWith(path)) {
          if (current.wd !== '/') {
            current = current.setWd('/')
          }
          return current
        }
        const rest = engine.wd.substring(path.length) || '/'
        if (current.wd === rest) {
          return current
        }
        return current.setWd(rest)
      })
    })
    const pathDrain = each(pathIterator, (pulse) => {
      debug('path update', pulse)
      syncer.update(pulse)
    })
    const crispDrain = each(crispIterator, (crisp) => {
      if (crisp.wd !== engine.wd) {
        crisp = crisp.setWd(engine.wd)
      }
      debug('crisp update', crisp)
      setCrisp(crisp)
    })
    const drains = [wdDrain, pathDrain, crispDrain]
    drains.forEach(drain)
    return () => {
      debug('teardown')
      wdIterator.return()
      pathIterator.return()
      crispIterator.return()
      setCrisp(Crisp.createLoading())
    }
  }, [path, engine])
  children = React.cloneElement(children, { crisp })
  return children
}
ReactSyncer.propTypes = {
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
}
ReactSyncer.defaultProps = {
  path: '/',
  sync: true,
}
const stripTrailingSlash = (path) => {
  if (path === '/') {
    return path
  }
  if (path.endsWith('/')) {
    return path.substring(0, path.length - 1)
  }
  return path
}

const UnWrapper = ({ crisp, path = '/', children }) => {
  if (crisp.isLoading || !crisp.hasChild(path)) {
    return <div>Loading...</div>
  }
  const child = crisp.getChild(path)
  debug('child', child)
  children = React.cloneElement(children, { crisp: child })
  return children
}
UnWrapper.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  path: PropTypes.string,
  children: PropTypes.node,
}
ReactSyncer.UnWrapper = UnWrapper
