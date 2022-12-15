import { api } from '@dreamcatcher-tech/interblock'
import React, { useState, useMemo } from 'react'
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
  const [sector, onSector] = useState()
  const [marker, onMarker] = useState()
  const onDateChange = (date) => {
    setRunDate(date)
    onSector()
    // check if we have a manifest for the given date
    // if so, cd into the directory
  }
  const { manifest, sectors, generator } = useMemo(() => {
    const manifest = utils.generateManifest(complex.tree, runDate)
    const sectors = utils.sectorsOnDay(complex.tree, runDate)
    const generator = generatorFactory(manifest, templateUrl, sector)
    return { manifest, sectors, generator }
  }, [complex.tree, runDate, templateUrl, sector])
  const sectorComplex = sectors.hasChild(sector) ? sectors.child(sector) : null
  if (!sectorComplex && sectors.network.length) {
    onSector(sectors.network[0].path)
  }

  const [open, setOpen] = useState(false)
  const onClose = () => setOpen(false)
  const events = { onPrint: () => setOpen(true) }
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <Date {...{ runDate, onDateChange }}></Date>
          <SectorSelector {...{ complex: sectors, sector, onSector }} />
          {sectorComplex && (
            <SorterDatum
              viewOnly
              complex={sectorComplex}
              marker={marker}
              onMarker={onMarker}
            />
          )}
        </Glass.Left>
        <Glass.Center>
          <Manifest complex={manifest} {...{ expanded, sector }} />
        </Glass.Center>
      </Glass.Container>
      <Map
        complex={sectors}
        onSector={onSector}
        sector={sector}
        onMarker={onMarker}
        marker={marker}
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
