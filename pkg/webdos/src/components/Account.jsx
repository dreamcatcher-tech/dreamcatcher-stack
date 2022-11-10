import React from 'react'
import Debug from 'debug'
import { OpenDialog, Datum } from '.'
const debug = Debug('terminal:widgets:Account')

const Account = () => {
  const { matchedPath, pulse } = useRouter()
  const state = pulse.getState().toJS()
  // TODO assert that it is a Datum ?
  debug(`state`, state)
  const { title = '', description = '' } = state.schema || {}
  return (
    <OpenDialog title={title}>
      <Datum block={pulse} />
    </OpenDialog>
  )
}

export default Account
