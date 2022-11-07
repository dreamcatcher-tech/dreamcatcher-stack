import Complex from '../Complex'
import { apps } from '@dreamcatcher-tech/interblock'
import sectorList from '../../../../data/sectors'
const { list, ...formData } = sectorList
const network = list.map((sector, index) => {
  const state = {
    ...apps.sector.state,
    formData: {
      ...sector,
      order: ['custNo-0345', 'custNo-3234', 'custNo-2345'],
    },
  }
  return { path: index.toString(), state }
})
console.log('network', network)
export default Complex.create({
  state: {},
  network: [
    { path: 'schedule', state: {} },
    { path: 'customers', state: {} },
    { path: 'routing', state: { formData }, network },
    { path: 'settings', state: {} },
    { path: 'about', state: {} },
    { path: 'account', state: {} },
  ],
  wd: '/schedule',
})
