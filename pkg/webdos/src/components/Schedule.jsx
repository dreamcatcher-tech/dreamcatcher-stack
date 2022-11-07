import Complex from '../Complex'
import React from 'react'
import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  Map,
  ScheduleSpeedDial,
  Manifest,
  SectorSelector,
  SectorDisplay,
} from '.'
import { Grid, Card, CardContent, Stack } from '@mui/material'
import { Date } from '.'
import Debug from 'debug'

const debug = Debug('terminal:widgets:Schedule')

const Schedule = ({ complex }) => {
  const [runDate, setRunDate] = useState(Date.today())
  const onDateChange = (date) => {
    setRunDate(date)
    // check if we have a minfest for the given date
    // if so, cd into the directory
    onSelected('')
  }
  const routing = complex.tree.child('routing')
  debug('routing', routing)
  const { commonDate } = routing.state.formData
  debug('commonDate', commonDate)
  const network = routing.network.filter(({ state: { formData: sector } }) =>
    isSectorOnDate(sector, commonDate, runDate)
  )
  complex = complex.setNetwork(network)
  const [selected, onSelected] = React.useState('')
  const sector = complex.hasChild(selected) ? complex.child(selected) : null
  if (!sector && complex.network.length) {
    onSelected(complex.network[0].path)
  }
  return (
    <>
      <Map {...{ complex }}>
        <Grid container spacing={2}>
          <Grid item xs={5}>
            <Stack spacing={2}>
              <Date {...{ runDate, onDateChange }}></Date>
              <SectorSelector {...{ complex, selected, onSelected }} />
              <SectorDisplay complex={sector} />
            </Stack>
          </Grid>
          <Grid item xs={7}>
            {/* <Manifest state={manifestState} /> */}
          </Grid>
        </Grid>
      </Map>
      <ScheduleSpeedDial />
    </>
  )
}
Schedule.propTypes = { complex: PropTypes.instanceOf(Complex).isRequired }

export default Schedule

import dayjs from 'dayjs'

function isSectorOnDate(sector, commonDate, runDate) {
  if (!commonDate) {
    return false
  }
  const sectorFirstDate = dayjs(commonDate).add(sector.frequencyOffset, 'days')
  const diff = calcDiffInDays(sectorFirstDate, runDate)
  return diff % sector.frequencyInDays === 0
}
function calcDiffInDays(startDate, endDate) {
  const startMoment = dayjs(startDate)
  const endMoment = dayjs(endDate)
  const diff = endMoment.diff(startMoment, 'days')
  return diff
}
