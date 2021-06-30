import React, { useState } from 'react'
import Debug from 'debug'
import OpenDialog from './OpenDialog'
import Form from '@rjsf/material-ui'
import { useBlockchain } from '@dreamcatcher-tech/web-components'

const debug = Debug('terminal:widgets:Settings')

const Settings = ({ block }) => {
  const { state } = block
  // TODO assert that this matches the settings schema
  const { schema, formData: storedFormData } = state
  const { title, ...noTitleSchema } = schema
  const [liveFormData, setLiveFormData] = useState(storedFormData)
  const { isPending } = useBlockchain()
  const onBlur = (...args) => {
    debug(`onBlur: `, ...args)
  }
  const setDatum = (formData) => {
    const string = JSON.stringify(formData)
    debug(`setDatum`, string)
    // show an enquiring modal UI over the top to get the data we need

    const command = `./set --formData ${string}\n`
    for (const c of command) {
      process.stdin.send(c)
    }
  }
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setLiveFormData(formData)
    // if any booleans changed, then apply the changes immediately

    // ? what is the action to call on the blockchain ?
    setDatum(formData)
  }
  return (
    <OpenDialog title={title}>
      <Form
        disabled={isPending}
        schema={noTitleSchema}
        formData={liveFormData}
        children
        onBlur={onBlur}
        onChange={onChange}
      />
    </OpenDialog>
  )
}

export default Settings
