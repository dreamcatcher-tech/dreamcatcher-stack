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
// TODO use binary in Crisp
import { templateUrl } from '../stories/data'
import FabAdd from './FabAdd'
import assert from 'assert-fast'
const { utils } = apps.crm
const debug = Debug('terminal:widgets:Schedules')

const Schedules = ({ crisp, customers, routing, expanded }) => {
  debug('selectedChild', crisp.getSelectedChild(), crisp)
  const runDate = crisp.getSelectedChild() || Date.nearestWeekday()
  debug('runDate', runDate)

  const onDateChange = (date) => {
    debug('onDateChange', date)
    if (date === runDate) {
      debug('no date change')
      return
    }
    // do not close the date selector if there is no child
    crisp.actions.cd(crisp.absolutePath + '/' + date, true)
  }

  const [open, setOpen] = useState(false)
  const onClose = () => setOpen(false)
  const events = { onPrint: () => setOpen(true) }
  const schedule =
    !crisp.isLoading && crisp.hasChild(runDate) ? crisp.getChild(runDate) : null
  debug('schedule', schedule)

  if (schedule && !schedule.isLoadingActions) {
    const [first] = schedule.sortedChildren
    const selected = schedule.getSelectedChild()
    if (first && !selected && schedule.hasChild(first)) {
      const firstChild = schedule.getChild(first)
      if (!firstChild.isLoading) {
        schedule.actions.cd(schedule.absolutePath + '/' + first)
      }
    }
  }
  const [creating, setCreating] = useState(false)
  const onCreate = async () => {
    assert(!creating)
    setCreating(true)
    debug('onCreate', runDate)

    const unapproved = utils.unapprovedCustomers(runDate, routing)
    if (unapproved.length) {
      window.alert(unapproved.join('\n'))
      setCreating(false)
      return
    }
    crisp.actions
      .create(runDate, routing.absolutePath, customers.absolutePath)
      .finally(() => setCreating(false))
  }
  let run
  if (schedule && schedule.getSelectedChild()) {
    run = schedule.getChild(schedule.getSelectedChild())
  }
  return (
    <>
      <Glass.Container>
        <Glass.Left min={!schedule}>
          <Date
            runDate={runDate}
            onDateChange={onDateChange}
            expanded={!schedule}
          />
          {schedule && <SectorSelector crisp={schedule} />}
          {run && <SorterDatum viewOnly crisp={run} customers={customers} />}
        </Glass.Left>
        <Glass.Center>
          {/* {schedule && <Manifest crisp={crisp} expanded={expanded} />} */}
        </Glass.Center>
      </Glass.Container>
      <Fab schedule={schedule} onCreate={onCreate} creating={creating} />
      <Map routing={schedule} customers={customers} />
      {/* <PdfModal {...{ runDate, open, onClose }} /> */}
    </>
  )
}
Schedules.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),

  /**
   * List of customers used to enrich the displayed customers
   */
  customers: PropTypes.instanceOf(Crisp),

  /**
   * List of sectors used for checking if a schedule can be created
   */
  routing: PropTypes.instanceOf(Crisp),

  /**
   * Testing: Expand the manifest panel
   */
  expanded: PropTypes.bool,
}

const Fab = ({ schedule, onCreate, creating }) => {
  if (schedule) {
    return <ScheduleSpeedDial />
  }
  return <FabAdd onClick={onCreate} disabled={creating} />
}
Fab.propTypes = {
  schedule: PropTypes.instanceOf(Crisp),
  onCreate: PropTypes.func,
  creating: PropTypes.bool,
}

export default Schedules
