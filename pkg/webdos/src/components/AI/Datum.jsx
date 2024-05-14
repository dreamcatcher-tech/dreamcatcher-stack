import PropTypes from 'prop-types'
import equals from 'fast-deep-equal'
import { Crisp } from '@dreamcatcher-tech/interblock'
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
  debug('Datum', crisp.state)
  // this is now just plain text markdown
  const theme = createTheme()
  const noDisabled = createTheme({ palette: { text: { disabled: '0 0 0' } } })
  assert(!viewOnly || !editing, 'viewOnly and editing are mutually exclusive')

  const [state] = useState(crisp.state)
  const [startingState, setStartingState] = useState(crisp.state)

  if (!equals(startingState, crisp.state)) {
    // TODO tell HAL if the state changes during the display
    // or, since it is read only, this shouldn't matter
    // editing any given element would focus that element
    // should at least highlight the display to say that it changed
    // then let HAL answer questions about who changed it and to what
    debug('state changed', startingState, crisp.state)
    setStartingState(crisp.state)
  }
  const isDirty = !equals(state, startingState)
  debug('isDirty', isDirty)

  // now, how to get the schema out of the crisp ?

  // where should the uiSchema be now ?

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
              formData={state}
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
