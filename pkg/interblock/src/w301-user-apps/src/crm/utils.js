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
  const onDay = sectorsOnDay(rootComplex, runDate)
  const schedule = rootComplex.child('schedule')
  const defaultRow = {
    isDone: false,
    ebc: false,
    nabc: false,
    isGateLocked: false,
    isFenced: false,
    isDog: false,
    isVehicleBlocking: false,
  }
  const customers = rootComplex.child('customers')
  const network = onDay.network.map(({ path, state: { formData } }) => {
    const { order, ...rest } = formData
    const rows = order.map((path) => {
      const customer = customers.child(path)
      return {
        ...defaultRow,
        id: path,
        address: customer.state.formData.serviceAddress,
      }
    })
    return { path, state: { formData: { ...rest, rows } } }
  })
  const formData = {
    runDate,
    isPublished: false,
    isReconciled: false,
  }

  debug('formData', formData)
  const child = { path: runDate, state: { formData, template: '..' }, network }
  const manifest = schedule
    .setNetwork([...schedule.network, child])
    .child(runDate)
  return manifest
}

export const mapCustomers = (sector) => {
  assert(sector instanceof Complex)
  const { state } = sector
  const { order } = state.formData
  const mapping = new Map()
  const customers = sector.tree.child('customers')
  order.forEach((id) => {
    const customer = customers.child(id)
    const value = customer.state.formData.serviceAddress
    mapping.set(id, value)
  })
  return mapping
}
