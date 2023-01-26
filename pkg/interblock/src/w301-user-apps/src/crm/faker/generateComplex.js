import memoize from 'fast-memoize'
import { api, apps } from '../../../..'
import { generateCustomers } from './customers'
import sectorList from '../../../../../../../data/sectors'
import Debug from 'debug'
const debug = Debug('faker')
const { Complex } = api
import PolygonLookup from 'polygon-lookup'
const pip = (geometry, gps) => {
  // gps is an iterable of lat, lon, path
  const lookup = new PolygonLookup(geometry)
  const order = []
  for (const { latitude, longitude, path } of gps) {
    const result = lookup.search(longitude, latitude)
    if (result) {
      order.push(path)
    }
  }
  return order
}
const pipMap = (sector, customersNetwork) => {
  const gps = customersNetwork.map(({ state, path }) => {
    const { formData } = state
    return { ...formData.serviceGps, path }
  })
  const geometry = {
    type: 'FeatureCollection',
    features: [{ ...sector.geometry }],
  }
  const order = pip(geometry, gps)
  return order
}
function generateComplex(customerCount = 20) {
  const { list, ...formData } = sectorList
  debug('start generate customers')
  const customers = generateCustomers(customerCount)
  debug('stop generate customers')
  debug('start pip')
  const network = list.map((sector, index) => {
    const order = pipMap(sector, customers.network)
    const state = {
      ...apps.crm.sector.state,
      formData: { ...sector, order },
    }
    return { path: index.toString(), state }
  })
  debug('stop pip')

  const actions = api.schemaToFunctions(apps.crm.dbSyncer.api)

  const complex = Complex.create({
    state: {},
    network: [
      { path: 'schedule', state: apps.crm.schedule.installer.state },
      { path: 'customers', ...customers },
      { path: 'routing', state: { formData }, network },
      { path: 'settings', state: apps.crm.dbSyncer.state, actions },
      { path: 'about', state: {} },
      { path: 'account', state: {} },
    ],
    wd: '/schedule',
  })
  return complex
}
export default memoize(generateComplex)
