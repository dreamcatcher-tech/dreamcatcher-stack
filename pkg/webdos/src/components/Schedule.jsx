import { api } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import {
  PdfModal,
  Map,
  ScheduleSpeedDial,
  Manifest,
  SectorSelector,
  Glass,
  SorterDatum,
} from '.'
import generatorFactory from '../pdfs'
import { Date } from '.'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
// TODO use binary in Complex
import { templateUrl } from '../stories/data'
const { utils } = apps.crm
const debug = Debug('terminal:widgets:Schedule')

const Schedule = ({ complex, expanded }) => {
  const [runDate, setRunDate] = useState(Date.weekday())
  const onDateChange = (date) => {
    setRunDate(date)
    onSelected()
    // check if we have a minfest for the given date
    // if so, cd into the directory
  }
  const { manifest, sectors, generator } = useMemo(() => {
    const manifest = utils.generateManifest(complex.tree, runDate)
    const sectors = utils.sectorsOnDay(complex.tree, runDate)
    const generator = generatorFactory(manifest, templateUrl)
    return { manifest, sectors, generator }
  }, [complex.tree, runDate, templateUrl])
  const [selected, onSelected] = React.useState()
  const sector = sectors.hasChild(selected) ? sectors.child(selected) : null
  if (!sector && sectors.network.length) {
    onSelected(sectors.network[0].path)
  }

  const [open, setOpen] = useState(false)
  const onClose = () => setOpen(false)
  const events = { onPrint: () => setOpen(true) }
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <Date {...{ runDate, onDateChange }}></Date>
          <SectorSelector {...{ complex: sectors, selected, onSelected }} />
          {sector && (
            <>
              <SorterDatum {...{ complex: sector, selected, onSelected }} />
            </>
          )}
        </Glass.Left>
        <Glass.Center>
          <Manifest complex={manifest} {...{ expanded, selected }} />
        </Glass.Center>
      </Glass.Container>
      <Map
        complex={sectors}
        onSector={onSelected}
        selected={selected}
        markers
      />
      <ScheduleSpeedDial events={events} />
      <PdfModal {...{ runDate, open, onClose, generator }} />
    </>
  )
}
Schedule.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  expanded: PropTypes.bool,
}

export default Schedule
