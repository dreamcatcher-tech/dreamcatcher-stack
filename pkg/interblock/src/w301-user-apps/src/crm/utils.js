import dayjs from 'dayjs'
import { Complex } from '../../../w002-api'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('crm:utils')

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
export const sectorsOnDay = (rootComplex, runDate) => {
  assert(rootComplex instanceof Complex, 'rootComplex must be a Complex')
  assert.strictEqual(typeof runDate, 'string', 'runDate must be a string')
  const routing = rootComplex.child('routing')
  const { commonDate } = routing.state.formData
  const network = routing.network.filter(({ state: { formData: sector } }) =>
    isSectorOnDate(sector, commonDate, runDate)
  )
  // TODO modify the order to have only customers for this day
  return routing.setNetwork(network)
}

export const generateManifest = (rootComplex, runDate) => {
  assert(rootComplex instanceof Complex, 'rootComplex must be a Complex')
  assert.strictEqual(typeof runDate, 'string', 'runDate must be a string')
  const routing = rootComplex.child('routing')
  const onDay = sectorsOnDay(rootComplex, runDate)
  const schedule = rootComplex.child('schedule')
  const { state } = schedule
  const rows = onDay.network.map(({ state: { formData: sector } }) => {
    const { order } = sector
    const row = order.map((path) => {
      const { state } = rootComplex.child('customers').child(path)
      const { formData } = state
      return { ...formData, id: path }
    })
    return row
  })
  const formData = {
    runDate,
    isPublished: false,
    isReconciled: false,
    rows: rows.flat(),
  }

  debug('formData', formData)
  const child = { path: runDate, state: { formData, template: '..' } }

  const manifest = schedule
    .setNetwork([...schedule.network, child])
    .child(runDate)
  return manifest
}
