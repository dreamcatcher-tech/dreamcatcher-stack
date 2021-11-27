import { validatorsSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
import { Keypair } from '.'

export class Validators extends mixin(validatorsSchema) {
  static create(keypair = Keypair.create()) {
    const entry = keypair.getValidatorEntry()
    return super.create(entry)
  }
}
