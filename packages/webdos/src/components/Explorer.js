/**
 * A default component that renders if nothing specified for the object.
 * Renders itself as a list of children, then renders the selected child indented.
 */
import React from 'react'
import { useBlockstream } from '@dreamcatcher-tech/web-components'
import Debug from 'debug'
import { getNextPath } from '../utils' // TODO remove this logic

const debug = Debug('terminal:Explorer')
const Explorer = (props) => {
  const { path, cwd = '/', widgets = {} } = props
  debug(`path: %s cwd: %s`, path, cwd)
  // walk from latest block down to the cwd, which represents the block we want
  const block = useBlockstream(cwd)
  if (!block) {
    return null
  }
  const Component = getComponent(cwd, widgets)
  if (Component) {
    return <Component block={block} path={path} cwd={cwd} widgets={widgets} />
  }
  const nextCwd = getNextPath(path, cwd)
  if (!nextCwd) {
    return null
  }
  // the current block has to have this alias in it somewhere, else some error
  const alias = nextCwd.split('/').pop()
  const nextChainId = block.network[alias].address.getChainId()
  const nextProps = { ...props, cwd: nextCwd, chainId: nextChainId }
  const child = nextCwd ? <Explorer {...nextProps} /> : null
  return child
}
const getComponent = (cwd, widgets) => {
  // if datum, use the jscon-schema-form
  // if collection, use the standard collection
  // else return Explorer as the standard component
  // OR always start with / since guaranteed to be first
  if (widgets[cwd]) {
    debug(`widget found for ${cwd}`)
    return widgets[cwd]
  }
  for (const key in widgets) {
    if (key.endsWith('*')) {
      const trimmed = cwd.substring(0, cwd.lastIndexOf('/'))
      const possible = trimmed + '/*'
      if (key === possible) {
        debug(`regex widget found for ${cwd} by matching ${key}`)
        return widgets[key]
      }
    }
  }
  return
}

export default Explorer
