import sectors from '../../../../data/sectors'
const { list, ...state } = sectors
const network = {}
list.forEach((sector, index) => {
  network[index] = sector
})
export default {
  state: {},
  network: {
    schedule: {},
    customers: {},
    routing: {
      state,
      network,
    },
    settings: {},
    about: {},
    account: {},
  },
  wd: '/schedule',
}
