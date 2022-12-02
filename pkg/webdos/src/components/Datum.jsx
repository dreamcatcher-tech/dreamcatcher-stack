import { createTheme, ThemeProvider } from '@mui/material/styles'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { api } from '@dreamcatcher-tech/interblock'
import React, { useState } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import CardHeader from '@mui/material/CardHeader'
import IconButton from '@mui/material/IconButton'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import { Actions } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('terminal:widgets:Datum')

const theme = createTheme()
const noDisabled = createTheme({
  palette: { text: { disabled: '0 0 0' } },
})

const Datum = ({ complex, collapsed, readonly, editing }) => {
  // TODO verify the covenant is a datum
  // TODO verify the chain children match the schema children
  assert(!readonly || !editing, 'readonly and editing are mutually exclusive')
  let { schema, formData, uiSchema } = complex.state
  if (schema === '..') {
    schema = complex.parent().state.template.schema
    uiSchema = complex.parent().state.template.uiSchema
  }
  const { title, ...noTitleSchema } = schema
  const [liveFormData, setLiveFormData] = useState(formData)
  const [isPending, setIsPending] = useState(false)
  const [state, setState] = useState(complex.state)
  const [isEditing, setIsEditing] = useState(editing)
  if (state !== complex.state) {
    debug('state changed', state, complex.state)
    setState(complex.state)
    setLiveFormData(formData)
    // TODO alert if changes not saved
  }
  const onBlur = (...args) => {
    debug(`onBlur: `, ...args)
  }
  const setDatum = (formData) => {
    debug(`setDatum`, formData)
    setIsPending(true)
    complex.actions.set(formData).then(() => setIsPending(false))
  }
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setLiveFormData(formData)
  }

  // TODO strip out the datum standard actions

  debug('schema', schema)
  debug('uiSchema', uiSchema)
  debug('formData', liveFormData)

  const noHidden = {
    ...noTitleSchema,
    properties: { ...noTitleSchema.properties },
  }
  Object.keys(noHidden.properties).forEach((key) => {
    if (uiSchema[key] && uiSchema[key]['ui:widget'] === 'hidden') {
      debug('removing hidden else rjsf loads slowly', key)
      delete noHidden.properties[key]
    }
  })
  const [expanded, setExpanded] = useState(!collapsed)
  const onSubmit = () => {
    debug('onSubmit', liveFormData)
    setIsEditing(false)
  }
  uiSchema = { ...uiSchema, 'ui:submitButtonOptions': { norender: true } }
  let form
  const onSave = (e) => {
    debug('onSave', e)
    e.stopPropagation()
    const result = form.submit()
    debug('result', result)
  }
  const onCancel = (e) => {
    debug('onCancel', e)
    e.stopPropagation()
    setIsEditing(false)
    if (liveFormData !== formData) {
      setLiveFormData(formData)
    }
  }
  const Editing = (
    <>
      <IconButton aria-label="save" onClick={onSave}>
        <Save color="primary" />
      </IconButton>
      <IconButton aria-label="cancel" onClick={onCancel}>
        <Cancel color="secondary" />
      </IconButton>
    </>
  )
  const onEdit = (e) => {
    debug('onEdit', e)
    setExpanded(true)
    e.stopPropagation()
    setIsEditing(true)
  }
  const Viewing = (
    <IconButton aria-label="edit" onClick={onEdit}>
      <Edit color="primary" />
    </IconButton>
  )
  const onExpand = (e, isExpanded) => {
    if (isEditing) {
      if (liveFormData === formData) {
        onCancel(e)
      } else {
        return
      }
    }
    setExpanded(isExpanded)
  }
  return (
    <Accordion expanded={expanded} onChange={onExpand}>
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="large" />}>
        <CardHeader title={title} sx={{ p: 0, flexGrow: 1 }} />
        {isEditing ? Editing : readonly ? null : Viewing}
      </AccordionSummary>
      <AccordionDetails>
        <ThemeProvider theme={isEditing ? theme : noDisabled}>
          <Form
            validator={validator}
            disabled={isPending}
            readonly={!isEditing}
            schema={noHidden}
            uiSchema={uiSchema}
            formData={liveFormData}
            onBlur={onBlur}
            onChange={onChange}
            onSubmit={onSubmit}
            ref={(_) => (form = _)}
          />
        </ThemeProvider>
        <Actions actions={complex.actions}></Actions>
      </AccordionDetails>
    </Accordion>
  )
}
Datum.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  collapsed: PropTypes.bool,
  readonly: PropTypes.bool,
  editing: PropTypes.bool,
}
export default Datum
