import React from 'react'

const createNamedContext = (name) => {
  const context = React.createContext()
  context.displayName = name
  return context
}
const context = createNamedContext('Router')

export default context
