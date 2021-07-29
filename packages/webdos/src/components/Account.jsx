import React from 'react'
import Debug from 'debug'
import { useRouter } from '../hooks'
import OpenDialog from './OpenDialog'
import Datum from './Datum'
const debug = Debug('terminal:widgets:Account')

const Account = () => {
  const { blocks, match, cwd } = useRouter()
  const [block] = blocks
  if (!block) {
    debug(`not enough info to render`)
    return null
  }
  const { state } = block
  // TODO assert that it is a Datum ?
  debug(`state`, state)
  const { title = '', description = '' } = state.schema || {}
  return (
    <OpenDialog title={title}>
      <Datum block={block} />
    </OpenDialog>
  )
}

export default Account
