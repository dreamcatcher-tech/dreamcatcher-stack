import { api } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  Map,
  ScheduleSpeedDial,
  Manifest,
  SectorSelector,
  SectorDisplay,
  Glass,
} from '.'
import { Date } from '.'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
const { utils } = apps.crm
const debug = Debug('terminal:widgets:Schedule')

const Schedule = ({ complex, expanded }) => {
  const [runDate, setRunDate] = useState(Date.today())
  const onDateChange = (date) => {
    setRunDate(date)
    onSelected()
    // check if we have a minfest for the given date
    // if so, cd into the directory
  }
  const manifest = utils.generateManifest(complex.tree, runDate)
  const sectors = utils.sectorsOnDay(complex.tree, runDate)
  const [selected, onSelected] = React.useState()
  const sector = sectors.hasChild(selected) ? sectors.child(selected) : null
  if (!sector && sectors.network.length) {
    onSelected(sectors.network[0].path)
  }
  return (
    <>
      <Map complex={sectors} onSector={onSelected} markers />
      <Glass.Container>
        <Glass.Left>
          <Date {...{ runDate, onDateChange }}></Date>
          <SectorSelector {...{ complex: sectors, selected, onSelected }} />
          <SectorDisplay complex={sector} />
        </Glass.Left>
        <Glass.Rest>
          <Manifest complex={manifest} {...{ expanded, selected }} />
        </Glass.Rest>
      </Glass.Container>
      <ScheduleSpeedDial />
    </>
  )
}
Schedule.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  expanded: PropTypes.bool,
}

export default Schedule
