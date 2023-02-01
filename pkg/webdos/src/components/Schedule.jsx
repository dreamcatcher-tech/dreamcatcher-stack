import { Crisp } from '@dreamcatcher-tech/interblock'
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

const Schedule = ({ crisp, expanded }) => {
  const [runDate, setRunDate] = useState(Date.nearestWeekday())
  const [marker, onMarker] = useState()
  const sector = crisp.getSelectedChild()
  const onDateChange = (date) => {
    setRunDate(date)
    // check if we have a manifest for the given date
    // if so, cd into the directory
  }
  const { manifest, sectors, generator } = useMemo(() => {
    const manifest = utils.generateManifest(crisp.root, runDate)
    const sectors = utils.sectorsOnDay(crisp.root, runDate)
    const generator = generatorFactory(manifest, templateUrl, sector)
    return { manifest, sectors, generator }
  }, [crisp.root, runDate, templateUrl, sector])
  const sectorComplex = sectors.hasChild(sector) ? sectors.child(sector) : null
  if (!sectorComplex && sectors.network.length) {
    // onSector(sectors.network[0].path)
  }

  const [open, setOpen] = useState(false)
  const onClose = () => setOpen(false)
  const events = { onPrint: () => setOpen(true) }
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <Date {...{ runDate, onDateChange }}></Date>
          <SectorSelector {...{ crisp: sectors }} />
          {sectorComplex && <SorterDatum viewOnly complex={sectorComplex} />}
        </Glass.Left>
        <Glass.Center>
          <Manifest complex={manifest} {...{ expanded, sector }} />
        </Glass.Center>
      </Glass.Container>
      <Map crisp={sectors} markers />
      <ScheduleSpeedDial events={events} />
      <PdfModal {...{ runDate, open, onClose, generator }} />
    </>
  )
}
Schedule.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  expanded: PropTypes.bool,
}

export default Schedule
