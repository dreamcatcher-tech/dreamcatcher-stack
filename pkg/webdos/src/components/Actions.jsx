import React, { useState } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import LoadingButton from '@mui/lab/LoadingButton'
import Cancel from '@mui/icons-material/Cancel'
import Send from '@mui/icons-material/Send'
import Debug from 'debug'
import PropTypes from 'prop-types'
const debug = Debug('terminal:widgets:Actions')

const Actions = ({ crisp }) => {
  if (crisp.isLoadingActions) {
    return <div>Loading Actions...</div>
  }
  const { actions } = crisp
  const cards = []
  for (const key in actions) {
    // TODO strip out the datum standard actions
    const action = actions[key]
    cards.push(<Action action={action} key={cards.length} />)
  }
  return <Stack spacing={2}>{cards}</Stack>
}
Actions.propTypes = {}
const Action = ({ action }) => {
  const { schema = {} } = action
  const { title, ...noTitleSchema } = schema

  const [liveFormData, setLiveFormData] = useState({})
  const [isPending, setIsPending] = useState(false)
  const onBlur = (...args) => {
    debug(`onBlur: `, ...args)
  }
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setLiveFormData(formData)
  }
  const reset = () => {
    setIsPending(false)
    setLiveFormData({})
  }
  const submit = () => {
    debug('submit', liveFormData)
    const promise = action(liveFormData)
    setIsPending(true)
    promise
      .then((result) => {
        debug('result', result)
        setIsPending(false)
      })
      .catch((error) => {
        setIsPending(false)
        debug('error', error)
        console.error(error)
      })
  }
  return (
    <Card sx={{ maxWidth: 345 }}>
      <CardContent>
        <Form
          validator={validator}
          disabled={isPending}
          schema={noTitleSchema}
          // uiSchema={uiSchema}
          formData={liveFormData}
          onBlur={onBlur}
          onChange={onChange}
          onSubmit={submit}
        >
          <Grid container justifyContent="space-between">
            <LoadingButton
              type="submit"
              variant="contained"
              color="warning"
              endIcon={<Send />}
              loading={isPending}
              loadingPosition="end"
            >
              {title}
            </LoadingButton>
            {isPending && (
              <IconButton aria-label="reset" onClick={reset}>
                <Cancel color="secondary" fontSize="small" />
              </IconButton>
            )}
          </Grid>
        </Form>
      </CardContent>
    </Card>
  )
}
Action.propTypes = {
  action: PropTypes.func,
  onAction: PropTypes.func,
}
Actions.Action = Action
export default Actions
