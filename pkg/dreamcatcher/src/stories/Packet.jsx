import PropTypes from 'prop-types'
import equals from 'fast-deep-equal'
import { Crisp } from '@dreamcatcher-tech/webdos'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import React, { useState } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeader from '@mui/material/CardHeader'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import assert from 'assert-fast'
import Debug from 'debug'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
const debug = Debug('terminal:widgets:Datum')

const Datum = ({
  crisp,
  viewOnly,
  onEdit,
  collapsed,
  editing,
  uiSchema,
  onUpdate,
}) => {
  const theme = createTheme()
  const noDisabled = createTheme({ palette: { text: { disabled: '0 0 0' } } })
  assert(!viewOnly || !editing, 'viewOnly and editing are mutually exclusive')

  const [formData, setFormData] = useState(crisp.state.formData)
  const [isPending, setIsPending] = useState(false)
  const [isEditing, setIsEditingState] = useState(editing)
  const [expanded, setExpanded] = useState(!collapsed)
  const [startingState, setStartingState] = useState(crisp.state)

  const setIsEditing = (isEditing) => {
    setIsEditingState(isEditing)
    onEdit && onEdit(isEditing)
  }

  if (!equals(startingState, crisp.state)) {
    debug('state changed', startingState, crisp.state)
    setStartingState(crisp.state)
    setFormData(crisp.state.formData)
    // TODO alert if changes not saved
  }
  const isDirty = !equals(formData, startingState.formData)
  debug('isDirty', isDirty)

  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setFormData(formData)
    onUpdate && onUpdate(formData)
  }
  const onSubmit = () => {
    debug('onSubmit', formData)
    setIsPending(true)
    crisp.ownActions.set({ formData }).then(() => {
      setIsPending(false)
      setIsEditing(false)
    })
  }
  const onSave = (e) => {
    debug('onSave', e)
    e.stopPropagation()
    form.submit()
  }
  const onCancel = (e) => {
    debug('onCancel', e)
    e.stopPropagation()
    setIsEditing(false)
    setFormData(crisp.state.formData)
  }
  const Editing = (
    <>
      <IconButton onClick={isPending ? null : onSave}>
        <Save color={isPending ? 'disabled' : 'primary'} />
      </IconButton>
      <IconButton onClick={isPending ? null : onCancel}>
        <Cancel color={isPending ? 'disabled' : 'secondary'} />
      </IconButton>
    </>
  )
  const onStartEdit = (e) => {
    debug('onEdit', e)
    setExpanded(true)
    e.stopPropagation()
    setIsEditing(true)
  }
  const Viewing = (
    <IconButton onClick={onStartEdit}>
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
  let { schema = {}, uiSchema: uiSchemaBase = {} } = crisp.state
  if (schema === '..' && crisp.parent) {
    schema = crisp.parent.state.template.schema
    uiSchemaBase = crisp.parent.state.template.uiSchema
  }
  uiSchema = uiSchema || {}
  uiSchema = {
    ...uiSchemaBase,
    ...uiSchema,
    'ui:submitButtonOptions': { norender: true },
  }
  const { title, ...noTitleSchema } = schema
  const noHidden = {
    ...noTitleSchema,
    properties: { ...noTitleSchema.properties },
  }
  Object.keys(noHidden.properties).forEach((key) => {
    if (uiSchema[key] && uiSchema[key]['ui:widget'] === 'hidden') {
      delete noHidden.properties[key]
    }
  })
  delete noHidden.additionalProperties // else rjsf errors
  let form
  return (
    <Card>
      <Accordion expanded={expanded} onChange={onExpand}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon fontSize="large" />}
          sx={{ display: 'flex' }}
        >
          <CardHeader title={title} sx={{ p: 0, flexGrow: 1 }} />
          {isEditing ? Editing : viewOnly ? null : Viewing}
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column' }}>
          <ThemeProvider theme={isEditing ? theme : noDisabled}>
            <Form
              validator={validator}
              disabled={isPending || !isEditing || viewOnly}
              schema={noHidden}
              uiSchema={uiSchema}
              formData={formData}
              onChange={onChange}
              onSubmit={onSubmit}
              ref={(_form) => (form = _form)}
            />
          </ThemeProvider>
        </AccordionDetails>
      </Accordion>
    </Card>
  )
}
Datum.propTypes = {
  /**
   * The crisp instance backing this Datum
   */
  crisp: PropTypes.instanceOf(Crisp),

  /**
   * Show no edit button - all fields are readonly
   */
  viewOnly: PropTypes.bool,

  /**
   * Callback when the edit status changes
   */
  onEdit: PropTypes.func,

  /** Override the uiSchema from the crisp */
  uiSchema: PropTypes.object,

  /** callback for when the form data changes */
  onUpdate: PropTypes.func,

  /**
   * Used in testing to start the component in collapsed mode
   */
  collapsed: PropTypes.bool,
  /**
   * Used in testing to start the component in editing mode
   */
  editing: PropTypes.bool,
}

export default Datum
