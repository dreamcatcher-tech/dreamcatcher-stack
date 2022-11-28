import largeJson from '@dreamcatcher-tech/interblock/src/w301-user-apps/src/crm/faker/large'
import mediumJson from '@dreamcatcher-tech/interblock/src/w301-user-apps/src/crm/faker/medium'
import smallJson from '@dreamcatcher-tech/interblock/src/w301-user-apps/src/crm/faker/small'
import templateUrl from './template.pdf'
import { api, apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'

const debug = Debug('webdos:stories:data')

const { crm } = apps
const [large, medium, small] = [largeJson, mediumJson, smallJson].map((obj) => {
  // update the templates for customers, schedules, and routing
  // TODO we should not need to patch anything
  // maybe data should be moved to a separate repo
  obj.network = obj.network.map((child) => {
    switch (child.path) {
      case 'customers':
        return child
      case 'schedule':
        return child
      case 'routing':
        const { schema, uiSchema } = crm.sector.state
        const network = child.network.map((sector) => {
          sector = { ...sector }
          delete sector.state.uiSchema
          sector.state.schema = '..'
          return sector
        })
        return {
          ...child,
          network,
          state: {
            ...child.state,
            template: { schema, uiSchema },
          },
        }
      default:
        return child
    }
  })

  return api.Complex.create(obj)
})

export { large, medium, small, templateUrl }
export default { large, medium, small, templateUrl }
