import * as schemas from './modelSchemas'
export const keypairSchema = {
  title: 'Keypair',
  // description: 'public private key pair',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'publicKey', 'secretKey'],
  properties: {
    name: { type: 'string' },
    publicKey: schemas.publicKeySchema,
    secretKey: {
      type: 'string', // TODO regex check based on algo in publicKey
    },
  },
}
