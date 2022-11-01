import React from 'react'
import { useState } from 'react'
import PropTypes from 'prop-types'
import { Map } from '.'
import { Grid, Card, CardContent, Stack } from '@mui/material'
import dayjs from 'dayjs'
import { TextField } from '@mui/material'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker'
import { Date } from '.'
import Debug from 'debug'
const debug = Debug('terminal:widgets:Services')

/**
 * Uses the data in the customer collection to generate a list of affected customers given a date.
 * Special in that it needs to generate the data it displays, rather than altering any state in chain land.  This data streams in as it is calculated, rather than waiting for the lengthy calculation to complete.
 * Once a date has passed, a snapshot of this day is stored in the "services" chain.
 * Shows a list of customers in order for a given date.
 */

const Schedule = ({}) => {
  const [dateString, setDate] = useState(Date.today())
  const onDateChange = (date) => {
    setDate(date)
  }
  return (
    <>
      <Map>
        <Date {...{ dateString, onDateChange }}></Date>
        <Card sx={{ minWidth: 345 }}>
          <CardContent>
            <div>meow</div>
            {/* <Actions actions={actions}></Actions> */}
          </CardContent>
        </Card>
      </Map>
    </>
  )
}
Schedule.propTypes = {
  // this is a test
  test: PropTypes.string,
}
Schedule.defaultProps = { test: 'm' }

export default Schedule
