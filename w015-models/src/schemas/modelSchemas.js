const actionSchema = {
  title: 'Action',
  description: `Messages for communicating with a chains reducer.
  Actions are always delivered as part of a channel between chains.`,
  type: 'object',
  required: ['type', 'payload'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      description: 'The type of the action which is specified by the developer',
    },
    payload: {
      type: 'object',
      description: 'Type dependent data being transmitted with the action',
    },
  },
}

const continuationSchema = {
  title: 'Continuation',
  description: `Actions that implement the continuation system.`,
  type: 'object',
  required: ['type', 'payload'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      description:
        'One of three types.  Synchronous replies are resolves or rejections too.',
      enum: ['@@REJECT', '@@PROMISE', '@@RESOLVE'],
    },
    payload: {
      type: 'object',
      description: 'Type dependent data being transmitted with the action',
    },
  },
}

const integritySchema = {
  title: 'Integrity',
  description: `cryptographically secure hash produced from content.
  May be 'UNKNOWN' to signal an address is unknown.`,
  type: 'object',
  additionalProperties: false,
  required: ['hash', 'algorithm'],
  properties: {
    // TODO apply regex
    hash: {
      type: 'string',
      description:
        'base58 encoded hash hopefully with identifier at front, or UNKNOWN',
    },
    algorithm: {
      enum: ['sha256'],
    },
  },
}

const addressSchema = {
  title: 'Address',
  description: `Hash of the Provenance of the first block in this chain, 
  with prefix, check digits, in base58`,
  type: 'object',
  additionalProperties: false,
  required: ['chainId', 'status'],
  properties: {
    chainId: integritySchema,
    status: { pattern: '^UNKNOWN$|^GENESIS_|^LOOPBACK$|^ROOT$|^RESOLVED$' },
  },
}

const publicKeySchema = {
  title: 'PublicKey',
  description: 'public key of a public / secret pair',
  type: 'object',
  additionalProperties: false,
  required: ['key', 'algorithm'],
  properties: {
    key: {
      type: 'string', // TODO format checks to set fixed length
    },
    algorithm: {
      enum: ['tweetnacl', 'sodium'],
    },
  },
}

const signatureSchema = {
  title: 'Signature',
  description: `A cryptographic signature of some detached integrity`,
  type: 'object',
  additionalProperties: false,
  required: ['publicKey', 'integrity', 'seal'],
  properties: {
    publicKey: publicKeySchema,
    integrity: integritySchema,
    seal: {
      type: 'string',
    },
  },
}

const provenanceSchema = {
  title: 'Provenance',
  description: `Proof of the Provenance of the object 
  referenced by signed integrity.
  The integrity of the first provenance in a chain is the chainId.
  When the provenance is inserted back into the dmz, the dmz becomes a Block.
  The integrity which is signed is the integrity of the whole object, 
  minus "integrity" and "signatures" keys
  
  Integrity can be a merkle proof so a set of chains with the same
  validators can create signatures for the root hash, then distribute
  to all the chains where each is blinded to the others in the merkle 
  proof.
  
  Running chains internally is much faster than cross block boundaries.`,
  type: 'object',
  additionalProperties: false,
  required: [
    'dmzIntegrity',
    'address',
    'lineage',
    'height', // TODO why care about height in git like structures ?
    'integrity',
    'signatures',
  ],
  properties: {
    dmzIntegrity: integritySchema,
    address: addressSchema,
    lineage: {
      type: 'object',
      description: `Object of previous blockhashes this provenance item extends.
  There may be many, but at least one is the most recent block provenance.
  Others might be those resulting from overdrive consensus,
  or periodic shortcutting of the chain history to quick lookup purposes.
  Height must always be greater than any previous provenance for this address.
  Provenance is monotonic, and should increment by 1 each time.
  
  First lineage supplied to create defines the chainId of the result.
  
  Provenance is a statement of authenticity and position in lineage.  
  Lineage is the chain of previous provenances.
  
  Key gives the provenance id, which can be height, or foreignChain:height.
  Value gives the hash of the block at the provenance id.`,
      patternProperties: {
        '(.*?)': integritySchema, // TODO apply naming convention to regex
      },
    },
    height: {
      type: 'integer',
      minimum: 0,
    },
    integrity: integritySchema,
    signatures: {
      // TODO ? use the aliases from the validator list to make human readable ?
      // problem is, would need prior knowledge, and couldn't check in place
      type: 'array',
      items: signatureSchema,
      minItems: 1,
      uniqueItems: true,
    },
  },
}

const validatorsSchema = {
  // list of aliases mapped to public keys
  title: 'Validators',
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  patternProperties: {
    '(.*?)': publicKeySchema,
  },
}

const proofSchema = {
  title: 'Proof',
  description: 'Interblock proof model.',
  type: 'object',
  additionalProperties: false,
  required: ['block'],
  properties: {
    block: { type: 'string' }, // TODO regex for hash string format
    network: { type: 'object' }, // concat of all channel hashes
    channel: { type: 'string' },
  },
}

const remoteSchema = {
  title: 'Remote',
  description: 'Slice of Channel state transmitted with a heavy Interblock',
  type: 'object',
  additionalProperties: false,
  required: ['address', 'replies', 'requests', 'heavyHeight', 'lineageHeight'],
  properties: {
    address: addressSchema,
    // TODO use a simpler raw queue underneath, wrapped in crypto, so ioQueues are the same
    replies: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '[0-9]*': continuationSchema,
      },
    },
    requests: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '[0-9]*': actionSchema,
      },
    },
    heavyHeight: { type: 'integer', minimum: -1 },
    lineageHeight: { type: 'integer', minimum: -1 },
  },
}

const interblockSchema = {
  title: 'Interblock',
  description: `The fundamental unit of inter chain communication.
  Contains provenance, a punched out DMZ, and a single transmit channel
  of the source chain.
  This must be an model, so as to ensure we do not leak info, rather 
  than making it a special case of a BlockModel.
  This cannot import dmzModel directly, as it is a fundamental
  circular reference, as the outside depends on the inside.
  This can only be made from a validated block.
  
  This is the only place that needs punched out proofs.
  
  With no transmit key, an interblock is simply a provenance chain,
  which is needed to ensure lineage
  
  By placing interblock stream inside the transmission, each side of
  a connection can know what block of theirs the other side has processed.`,
  type: 'object',
  // TODO make all but provenance optional to save retransmit all the time
  required: ['provenance', 'proof', 'validators'],
  additionalProperties: false,
  properties: {
    provenance: provenanceSchema,
    proof: proofSchema,
    network: {
      type: 'object',
      additionalProperties: false,
      minProperties: 0,
      maxProperties: 1,
      patternProperties: {
        '(.*?)': remoteSchema,
      },
    },
    validators: validatorsSchema,
  },
}

const channelSchema = {
  title: 'Channel',
  description: `Communication Queues.
  These queues and their responses are what all interchain
  communication seeks to facilitate.  All the cryptography
  employed in this system is to reliably process these 
  queues.
  
  Each connection side has a transmit and a receive.
  Each connection side transmits requests and replies to the other.
  
  Transmit = Sum( Channel ) 
  Receive = Sum( Interblock( Channel ) )
  Interblocks  = Channel + Provenance
  
  'provenance' contains a continuous chain all the way back to  the foreign genesis.
  
  The contents of the latest received channel is stored on 'remote'
  Replies are always processed before incoming requests.
  When a received reply has executed, the local transmit action is removed
  from the transmit queue.
  
  The queues hold the index for their next actions within them:
  1.  Next remote reply index is the smallest index of the transit queue
      for which there is a remote reply that is not a promise
  2.  Next remote request index is given by the local highest reply index
  
  If systemRole === '.' then provenance checks are excused, as the
  networkProducer.tx() function will flip outbound and inbound.  This is used
  in the self channel.
  
  Counter is required to know where the request counter is up to, which needs independent
  tracking as the channel might be cleared completely, but we cannot reuse numbers until
  looparound at 32bit limit or similar`,
  type: 'object',
  required: [
    ...remoteSchema.required,
    'systemRole',
    'requestsLength',
    'lineage', // hashes of provenances back to the last heavy block
    'lineageTip', // provenances that are new to the chain - purged each new block
  ],
  additionalProperties: false,
  properties: {
    ...remoteSchema.properties,
    systemRole: { enum: ['..', '.', './', 'UP_LINK', 'DOWN_LINK'] },
    requestsLength: { type: 'integer', minimum: 0 },
    heavy: interblockSchema, // last heavy interblock, in full
    lineage: { type: 'array', uniqueItems: true, items: integritySchema },
    lineageTip: {
      type: 'array',
      uniqueItems: true,
      items: interblockSchema,
    },
  },
}

module.exports = {
  integritySchema,
  addressSchema,
  proofSchema,
  interblockSchema,
  provenanceSchema,
  validatorsSchema,
  signatureSchema,
  publicKeySchema,
  remoteSchema,
  channelSchema,
  actionSchema,
  continuationSchema,
}
