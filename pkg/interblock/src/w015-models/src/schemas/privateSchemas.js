import { publicKeySchema } from './modelSchemas'
export const keypairSchema = {
  title: 'Keypair',
  // description: 'public private key pair',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'publicKey', 'secretKey'],
  properties: {
    name: { type: 'string' },
    publicKey: publicKeySchema,
    secretKey: {
      type: 'string', // TODO regex check based on algo in publicKey
    },
  },
}
