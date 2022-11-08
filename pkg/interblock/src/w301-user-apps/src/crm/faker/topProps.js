import { api, apps } from '../../../..'
import { customers } from './customers'
import sectorList from '../../../../../../../data/sectors'
import Debug from 'debug'
const debug = Debug('faker')
const { Complex } = api
const { list, ...formData } = sectorList
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
debug('start pip')
const network = list.map((sector, index) => {
  const order = pipMap(sector, customers.network)
  const state = {
    ...apps.sector.state,
    formData: { ...sector, order },
  }
  return { path: index.toString(), state }
})
debug('pip complete')

const complex = Complex.create({
  state: {},
  network: [
    { path: 'schedule', state: {} },
    { path: 'customers', ...customers },
    { path: 'routing', state: { formData }, network },
    { path: 'settings', state: {} },
    { path: 'about', state: {} },
    { path: 'account', state: {} },
  ],
  wd: '/schedule',
})

export default complex
