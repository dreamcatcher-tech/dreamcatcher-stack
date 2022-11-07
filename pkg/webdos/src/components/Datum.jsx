import Complex from '../Complex'
import React, { useState } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv6'
import { Card, CardHeader, CardContent, IconButton, Grid } from '@mui/material'
import { Edit, Cancel, Save } from '@mui/icons-material'
import { Actions } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('terminal:widgets:Datum')

const Datum = ({ complex }) => {
  // TODO verify the covenant is a datum
  // TODO verify the chain children match the schema children
  const { schema, formData, uiSchema } = complex.state
  const { title, ...noTitleSchema } = schema
  const [liveFormData, setLiveFormData] = useState(formData)
  const [isPending, setIsPending] = useState(false)
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

  debug(complex.actions)
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
Datum.propTypes = { complex: PropTypes.instanceOf(Complex).isRequired }
export default Datum
