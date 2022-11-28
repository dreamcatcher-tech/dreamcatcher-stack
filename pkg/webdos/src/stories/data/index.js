import largeJson from '@dreamcatcher-tech/interblock/src/w301-user-apps/src/crm/faker/large'
import mediumJson from '@dreamcatcher-tech/interblock/src/w301-user-apps/src/crm/faker/medium'
import smallJson from '@dreamcatcher-tech/interblock/src/w301-user-apps/src/crm/faker/small'
import templateUrl from './template.pdf'
import { api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'

const debug = Debug('webdos:stories:data')

debug('loading large')
const large = api.Complex.create(largeJson)
debug('loading medium')
const medium = api.Complex.create(mediumJson)
debug('loading small')
const small = api.Complex.create(smallJson)
debug('loading complete')

export { large, medium, small, templateUrl }
export default { large, medium, small, templateUrl }
