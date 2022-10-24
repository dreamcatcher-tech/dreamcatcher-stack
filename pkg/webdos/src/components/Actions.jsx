import React, { useState } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv6'
import { Card, CardHeader, CardContent, IconButton, Grid } from '@mui/material'
import { Edit, Cancel, Save } from '@mui/icons-material'
import { useBlockchain } from '../hooks'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('terminal:widgets:Datum')

const Actions = ({ actions }) => {
  // create a datum componentt from the action schemas

  const [liveFormData, setLiveFormData] = useState(formData)
  const [isPending, setIsPending] = useState(false)
  const onBlur = (...args) => {
    debug(`onBlur: `, ...args)
  }
  const setDatum = (formData) => {
    debug(`setDatum`, formData)
    setIsPending(true)
    actions.set(formData).then(() => setIsPending(false))
  }
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setLiveFormData(formData)
    // if any booleans changed, then apply the changes immediately
    // setDatum(formData)
  }

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
                <IconButton aria-label="edit">
                  <Save color="primary" />
                </IconButton>
                <IconButton aria-label="edit">
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
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default Actions
