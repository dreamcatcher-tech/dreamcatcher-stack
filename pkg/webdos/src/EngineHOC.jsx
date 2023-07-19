import React from 'react'
import Engine from './Engine.jsx'
import Syncer from './Syncer.jsx'
import assert from 'assert-fast'
import Debug from 'debug'

export const EngineHOC = (Component, debugLogs) => {
  if (debugLogs) {
    assert(typeof debugLogs === 'string')
    Debug.enable(debugLogs)
  }
  const WrappedComponent = (props) => (
    <Engine {...props}>
      <Syncer {...props}>
        <Component {...props} />
      </Syncer>
    </Engine>
  )

  WrappedComponent.displayName = `EngineHOC(${
    Component.displayName || Component.name || 'Component'
  })`

  return WrappedComponent
}
