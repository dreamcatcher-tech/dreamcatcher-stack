import React, { useState } from 'react'
import { OpenDialog } from '.'
import Form from '@rjsf/mui'
import Debug from 'debug'
const debug = Debug('terminal:widgets:Settings')

const Settings = () => {
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
