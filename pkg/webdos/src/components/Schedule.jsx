import React from 'react'
import { useState } from 'react'
import PropTypes from 'prop-types'
import { Map, ScheduleSpeedDial, Manifest, SectorSelector } from '.'
import { Grid, Card, CardContent, Stack } from '@mui/material'
import dayjs from 'dayjs'
import { TextField } from '@mui/material'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker'
import CancelIcon from '@mui/icons-material/Cancel'
import DoneIcon from '@mui/icons-material/Done'
import { Date } from '.'
import Debug from 'debug'

import { apps } from '@dreamcatcher-tech/interblock'
const { manifest } = apps
const debug = Debug('terminal:widgets:Services')

const Schedule = ({ manifestState = manifest.state }) => {
  const [dateString, setDate] = useState(Date.today())
  const onDateChange = (date) => {
    setDate(date)
    // check if we have a minfest for the given date
    // if so, cd into the directory
  }
  return (
    <>
      <Map>
        <Grid container spacing={2}>
          <Grid item xs={5}>
            <Stack spacing={2}>
              <Date {...{ dateString, onDateChange }}></Date>
              <SectorSelector />
              <Card sx={{ minWidth: 245 }}>
                <CardContent>
                  <div>Show Locations</div>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
          <Grid item xs={7}>
            <Manifest state={manifestState} />
          </Grid>
        </Grid>
      </Map>
      <ScheduleSpeedDial />
    </>
  )
}
Schedule.propTypes = {}

export default Schedule
