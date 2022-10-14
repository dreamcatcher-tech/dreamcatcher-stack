import PropTypes from 'prop-types'
import React from 'react'
import { useRef } from 'react'

export const AppContainerContext = React.createContext()
AppContainerContext.displayName = 'AppContainer'
const AppContainer = ({ children }) => {
  const style = {
    display: 'flex',
    flexFlow: 'column',
    flex: '1 1 auto',
    margin: 0,
    // must be a positioned element for an absolute child to be within this
    // Modal Dialog boxes use this to scope their bounds
    position: 'relative',
  }
  const ref = useRef(null)
  const isFocused =
    !!ref.current && ref.current.contains(document.activeElement)

  return (
    <AppContainerContext.Provider value={{ element: ref.current, isFocused }}>
      <div ref={ref} style={style}>
        {children}
      </div>
    </AppContainerContext.Provider>
  )
}
AppContainer.propTypes = {
  children: PropTypes.node,
}
export default AppContainer
