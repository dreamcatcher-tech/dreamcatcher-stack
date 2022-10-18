import React, { useState } from 'react'
import { makeStyles } from '@mui/styles'
import Form from '@rjsf/mui'
import { Card, CardHeader, CardContent, IconButton, Grid } from '@mui/material'
import { Edit, Cancel, Save } from '@mui/icons-material'
import { useBlockchain } from '../hooks'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('terminal:widgets:Datum')

const useStyles = makeStyles((theme) => ({
  // TODO try remove makeStyles and use basic classes
  root: {
    flexGrow: 1,
  },
  card: { maxWidth: 345 },
  paper: {
    padding: theme.spacing(2),
    // textAlign: 'center',
    // color: theme.palette.text.secondary,
  },
}))

// const DatumCard =

const Datum = ({ pulse }) => {
  assert.strictEqual(pulse.getCovenantPath(), '')
  const state = pulse.getState().toJS()
  const { schema, formData: storedFormData, uiSchema } = state
  const { title, ...noTitleSchema } = schema
  const [liveFormData, setLiveFormData] = useState(storedFormData)
  // TODO verify the covenant is a datum
  // TODO verify the chain children match the schema children

  // pull out the children from the block, so can draw these as visual children

  const onBlur = (...args) => {
    debug(`onBlur: `, ...args)
  }
  // const setDatum = (formData) => {
  //   const string = JSON.stringify(formData)
  //   debug(`setDatum`, string)
  //   // show an enquiring modal UI over the top to get the data we need

  //   const command = `./set --formData ${string}\n`
  //   for (const c of command) {
  //     process.stdin.send(c)
  //   }
  // }
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setLiveFormData(formData)
    // if any booleans changed, then apply the changes immediately

    // ? what is the action to call on the blockchain ?
    // setDatum(formData)
  }

  const classes = useStyles()
  return (
    <Grid container spacing={3}>
      <Grid item>
        <Card className={classes.card}>
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
              disabled={isPending}
              schema={noTitleSchema}
              uiSchema={uiSchema}
              formData={liveFormData}
              children
              onBlur={onBlur}
              onChange={onChange}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default Datum
