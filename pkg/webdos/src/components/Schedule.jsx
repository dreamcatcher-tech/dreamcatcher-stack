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
    onSelectedSector()
    // check if we have a minfest for the given date
    // if so, cd into the directory
  }
  const { manifest, sectors, generator } = useMemo(() => {
    const manifest = utils.generateManifest(complex.tree, runDate)
    const sectors = utils.sectorsOnDay(complex.tree, runDate)
    const generator = generatorFactory(manifest, templateUrl)
    return { manifest, sectors, generator }
  }, [complex.tree, runDate, templateUrl])
  const [selectedSector, onSelectedSector] = React.useState()
  const [marker, onMarker] = React.useState()
  const sector = sectors.hasChild(selectedSector)
    ? sectors.child(selectedSector)
    : null
  if (!sector && sectors.network.length) {
    onSelectedSector(sectors.network[0].path)
  }

  const [open, setOpen] = useState(false)
  const onClose = () => setOpen(false)
  const events = { onPrint: () => setOpen(true) }
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <Date {...{ runDate, onDateChange }}></Date>
          <SectorSelector
            {...{
              complex: sectors,
              selected: selectedSector,
              onSelected: onSelectedSector,
            }}
          />
          {sector && (
            <>
              <SorterDatum
                viewOnly
                {...{
                  complex: sector,
                  selected: marker,
                  onSelected: onMarker,
                }}
              />
            </>
          )}
        </Glass.Left>
        <Glass.Center>
          <Manifest
            complex={manifest}
            {...{ expanded, selected: selectedSector }}
          />
        </Glass.Center>
      </Glass.Container>
      <Map
        complex={sectors}
        onSector={onSelectedSector}
        selected={selectedSector}
        onMarker={onMarker}
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
