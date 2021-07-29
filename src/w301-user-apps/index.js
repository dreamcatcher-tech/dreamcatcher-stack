import { covenantIdModel } from '../w015-models'
import { crm } from './src/crm'
crm.covenantId = covenantIdModel.create('crm')

export { crm }
