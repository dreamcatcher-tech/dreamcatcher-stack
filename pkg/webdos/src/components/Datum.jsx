import { createTheme, ThemeProvider } from '@mui/material/styles'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { api } from '@dreamcatcher-tech/interblock'
import React, { useState, useEffect } from 'react'
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

const Datum = ({ complex, collapsed, viewonly, editing }) => {
  // TODO verify the covenant is a datum
  // TODO verify the chain children match the schema children
  assert(!viewonly || !editing, 'viewonly and editing are mutually exclusive')

  const [formData, setFormData] = useState(complex.state.formData)
  const [isPending, setIsPending] = useState(false)
  const [isEditing, setIsEditing] = useState(editing)
  const [expanded, setExpanded] = useState(!collapsed)
  const [startingState, setStartingState] = useState(complex.state)
  if (startingState !== complex.state) {
    debug('state changed', startingState, complex.state)
    setStartingState(complex.state)
    setFormData(complex.state.formData)
    // TODO alert if changes not saved
  }
  const isDirty = formData !== complex.state.formData
  debug('isDirty', isDirty)
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setFormData(formData)
  }

  const onSubmit = () => {
    debug('onSubmit', formData)
    setIsEditing(false)
    // setIsPending(true)
    // complex.actions.set(formData).then(() => setIsPending(false))
  }
  const [trySubmit, setTrySubmit] = useState(false)
  useEffect(() => {
    if (trySubmit) {
      setTrySubmit(false)
      debug('trySubmit lowered')
    }
  }, [trySubmit])
  const onSave = (e) => {
    debug('onSave', e)
    e.stopPropagation()
    setTrySubmit(true)
  }
  const onCancel = (e) => {
    debug('onCancel', e)
    e.stopPropagation()
    setIsEditing(false)
    if (isDirty) {
      setFormData(complex.state.formData)
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
      if (isDirty) {
        return
      }
      onCancel(e)
    }
    setExpanded(isExpanded)
  }
  let { schema } = complex.state
  if (schema === '..') {
    schema = complex.parent().state.template.schema
  }
  const { title } = schema
  return (
    <Accordion expanded={expanded} onChange={onExpand}>
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="large" />}>
        <CardHeader title={title} sx={{ p: 0, flexGrow: 1 }} />
        {isEditing ? Editing : viewonly ? null : Viewing}
      </AccordionSummary>
      <AccordionDetails>
        <ThemeProvider theme={isEditing ? theme : noDisabled}>
          <SchemaForm
            {...{
              complex,
              disabled: isPending,
              readonly: !isEditing,
              onChange,
              formData,
              trySubmit,
              onSubmit,
            }}
          />
          <Actions actions={complex.actions}></Actions>
        </ThemeProvider>
      </AccordionDetails>
    </Accordion>
  )
}
Datum.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  collapsed: PropTypes.bool,
  viewonly: PropTypes.bool,
  editing: PropTypes.bool,
}
export default Datum

const SchemaForm = ({
  complex,
  disabled,
  readonly,
  formData,
  trySubmit,
  onChange,
  onSubmit,
}) => {
  let { schema, uiSchema } = complex.state
  if (schema === '..') {
    schema = complex.parent().state.template.schema
    uiSchema = complex.parent().state.template.uiSchema
  }
  uiSchema = { ...uiSchema, 'ui:submitButtonOptions': { norender: true } }
  const { title, ...noTitleSchema } = schema
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
  let form
  useEffect(() => {
    if (trySubmit) {
      debug('trySubmit triggered')
      form.submit()
    }
  }, [trySubmit])
  return (
    <Form
      validator={validator}
      disabled={disabled}
      readonly={readonly}
      schema={noHidden}
      uiSchema={uiSchema}
      formData={formData}
      onChange={onChange}
      onSubmit={onSubmit}
      ref={(_form) => (form = _form)}
    />
  )
}
SchemaForm.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  disabled: PropTypes.bool,
  readonly: PropTypes.bool,
  formData: PropTypes.object,
  trySubmit: PropTypes.bool,
  onChange: PropTypes.func,
  onSubmit: PropTypes.func,
}
