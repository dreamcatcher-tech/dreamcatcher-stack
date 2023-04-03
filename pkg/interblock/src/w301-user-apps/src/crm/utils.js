import dayjs from 'dayjs'
import { Crisp } from '../../..'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('crm:utils')

export function isSectorOnDate(sector, commonDate, runDate) {
  if (!commonDate) {
    return false
  }
  const sectorFirstDate = dayjs(commonDate).add(sector.frequencyOffset, 'day')
  const diff = calcDiffInDays(sectorFirstDate, runDate)
  return diff % sector.frequencyInDays === 0
}
function calcDiffInDays(startDate, endDate) {
  const startMoment = dayjs(startDate)
  const endMoment = dayjs(endDate)
  const diff = endMoment.diff(startMoment, 'days')
  return diff
}
export const sectorsOnDay = (root, runDate) => {
  assert(root instanceof Crisp, 'root must be a Crisp')
  assert.strictEqual(typeof runDate, 'string', 'runDate must be a string')
  const routing = root.getChild('routing')
  const { commonDate } = routing.state.formData
  const network = routing.network.filter(({ state: { formData: sector } }) =>
    isSectorOnDate(sector, commonDate, runDate)
  )
  // TODO modify the order to have only customers for this day
  return routing.setNetwork(network)
}

export const generateManifest = (root, runDate) => {
  assert(root instanceof Crisp, 'root must be a Crisp')
  assert.strictEqual(typeof runDate, 'string', 'runDate must be a string')
  const onDay = sectorsOnDay(root, runDate)
  const schedule = root.child('schedule')
  const defaultRow = {
    isDone: false,
    ebc: false,
    nabc: false,
    isGateLocked: false,
    isFenced: false,
    isDog: false,
    isVehicleBlocking: false,
  }
  const customers = root.child('customers')
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

export const unapprovedCustomers = (runDate, routing) => {
  assert.strictEqual(typeof runDate, 'string', 'runDate must be a string')
  assert(routing instanceof Crisp)
  assert(!routing.isLoadingChildren)
  const { commonDate } = routing.state.formData
  const unapproved = []
  for (const key of routing.sortedChildren) {
    const sector = routing.getChild(key)
    assert(!sector.isLoading)
    const { formData } = sector.state
    if (isSectorOnDate(formData, commonDate, runDate)) {
      if (formData.unapproved?.length) {
        const msg = `Sector "${formData.name}" has ${formData.unapproved.length} unapproved customers`
        unapproved.push(msg)
      }
    }
  }
  return unapproved
}

export const COLORS = [
  'red',
  'orange',
  'yellow',
  'cyan',
  'purple',
  'violet',
  'pink',
  'green',
  'black',
]
