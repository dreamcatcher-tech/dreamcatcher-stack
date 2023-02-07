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

    const updateWd = (current) => {
      debug('wd update crisp was: %s wd is: %s', current.wd, engine.wd)
      if (!engine.wd.startsWith(path)) {
        if (current.wd !== '/') {
          current = current.setWd('/')
        }
        return current
      }
      const length = path === '/' ? 0 : path.length
      const rest = engine.wd.substring(length) || '/'
      debug('path %s rest %s', path, rest)
      if (current.wd === rest) {
        return current
      }
      return current.setWd(rest)
    }

    const wdDrain = each(wdIterator, () => setCrisp(updateWd))
    const pathDrain = each(pathIterator, (pulse) => {
      debug('path update', pulse)
      syncer.update(pulse)
    })
    const crispDrain = each(crispIterator, (crisp) => {
      debug('crisp update', crisp)
      setCrisp(updateWd(crisp))
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

const unDebug = debug.extend('UnWrapper')
const UnWrapper = ({ crisp, path = '/', children }) => {
  if (path !== '/' && path.startsWith('/')) {
    path = path.substring(1)
  }
  const segments = path.split('/')
  unDebug('segments', segments)
  let child = crisp
  for (const segment of segments) {
    if (child.isLoading || !child.hasChild(segment)) {
      unDebug('loading', path, crisp.isLoading, crisp)
      return <div>Loading...</div>
    }
    child = child.getChild(segment)
  }
  unDebug('child', child)
  children = React.cloneElement(children, { crisp: child })
  return children
}
UnWrapper.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  path: PropTypes.string,
  children: PropTypes.node,
}
ReactSyncer.UnWrapper = UnWrapper
