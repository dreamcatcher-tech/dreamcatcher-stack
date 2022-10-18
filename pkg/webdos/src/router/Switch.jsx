import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { Route, useBlockchain, usePathBlockstream } from '..'
import assert from 'assert-fast'
import RouterContext from './RouterContext'

const debug = Debug('webdos:router:Switch')

const Switch = ({ children }) => {
  children = React.Children.toArray(children)
  const routes = children.filter((child) => child.type === Route)
  debug(`found routes: ${routes.length}`)
  assert.strictEqual(children.length, routes.length)
  const { wd } = useBlockchain()
  debug(`wd`, wd)

  // TODO switch needs to be aware of when it is nested

  // for Route to be mounted, it must match the wd AND the pulse be present

  const latests = usePathBlockstream(wd)
  debug(`latests length`, Object.keys(latests).length)

  for (const route of routes) {
    const { covenant } = route.props
    if (covenant) {
      for (const path in latests) {
        const pulse = latests[path]
        const { covenant: toMatch } = pulse.provenance.dmz
        if (covenant === toMatch) {
          debug(`matched `, covenant, path)
          return wrapRoute(route, path, pulse)
        }
      }
    }
    const { path } = route.props
    if (path) {
      debug(`route path: `, path)
      if (wd.includes(path)) {
        const paths = Object.keys(latests)
        for (const segment of paths) {
          if (segment.includes(path)) {
            return wrapRoute(route, segment, latests[segment])
          }
        }
        debug('match not found in segments: ' + path + ' in ' + wd, latests)
      }
    }
  }

  return null
}
Switch.propTypes = {
  children: PropTypes.node,
}
const wrapRoute = (route, matchedPath, pulse) => {
  assert.strictEqual(typeof matchedPath, 'string')
  assert(pulse)
  return (
    <RouterContext.Provider value={{ matchedPath, pulse }}>
      {route}
    </RouterContext.Provider>
  )
}

export default Switch
