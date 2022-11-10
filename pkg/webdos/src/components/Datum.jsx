import { api } from '@dreamcatcher-tech/interblock'
import React, { useState } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import { Actions } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('terminal:widgets:Datum')

const Datum = ({ complex }) => {
  // TODO verify the covenant is a datum
  // TODO verify the chain children match the schema children
  let { schema, formData, uiSchema } = complex.state
  if (schema === '..') {
    schema = complex.parent().state.template.schema
    uiSchema = complex.parent().state.template.uiSchema
  }
  const { title, ...noTitleSchema } = schema
  const [liveFormData, setLiveFormData] = useState(formData)
  const [isPending, setIsPending] = useState(false)
  const [state, setState] = useState(complex.state)
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
    // if any booleans changed, then apply the changes immediately
    // setDatum(formData)
  }

  // TODO strip out the datum standard actions

  return (
    <Grid container spacing={3}>
      <Grid item>
        <Card sx={{ maxWidth: 345 }}>
          <CardHeader
            title={title}
            action={
              <>
                <IconButton aria-label="edit">
                  <Edit color="primary" />
                </IconButton>
                <IconButton aria-label="save">
                  <Save color="primary" />
                </IconButton>
                <IconButton aria-label="cancel">
                  <Cancel color="secondary" />
                </IconButton>
              </>
            }
          />
          <CardContent>
            <Form
              validator={validator}
              disabled={isPending}
              schema={noTitleSchema}
              uiSchema={uiSchema}
              formData={liveFormData}
              onBlur={onBlur}
              onChange={onChange}
            />
            <Actions actions={complex.actions}></Actions>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
Datum.propTypes = { complex: PropTypes.instanceOf(api.Complex).isRequired }
export default Datum
