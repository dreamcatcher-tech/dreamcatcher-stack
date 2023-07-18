import React from 'react'
import Engine from './Engine.jsx'
import Syncer from './Syncer.jsx'

export const EngineHOC = (Component) => {
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
