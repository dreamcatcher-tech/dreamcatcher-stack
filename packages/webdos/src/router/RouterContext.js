import React from 'react'
import { useContext } from 'react'

const createNamedContext = (name) => {
  const context = React.createContext()
  context.displayName = name
  return context
}
const context = createNamedContext('Router')

export default context

export const useRouterContext = () => useContext(context)
