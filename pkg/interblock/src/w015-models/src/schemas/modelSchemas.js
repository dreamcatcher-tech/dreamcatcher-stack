const actionSchema = {
  title: 'Action',
  // description: `Messages for communicating with a chains reducer.
  // Actions are always delivered as part of a channel between chains.`,
  type: 'object',
  required: ['type', 'payload'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      // description: 'The type of the action which is specified by the developer',
    },
    payload: {
      type: 'object',
      // description: 'Type dependent data being transmitted with the action',
    },
  },
}

const continuationSchema = {
  title: 'Continuation',
  // description: `Actions that implement the continuation system.`,
  type: 'object',
  required: ['type', 'payload'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      // description:
      //   'One of three types.  Synchronous replies are resolves or rejections too.',
      enum: ['@@REJECT', '@@PROMISE', '@@RESOLVE'],
    },
    payload: {
      type: 'object',
      // description: 'Type dependent data being transmitted with the action',
    },
  },
}

const integritySchema = {
  title: 'Integrity',
  // description: `cryptographically secure hash produced from content.
  // May be 'UNKNOWN' to signal an address is unknown.`,
  type: 'object',
  additionalProperties: false,
  required: ['hash', 'algorithm'],
  properties: {
    // TODO apply regex /\b[A-Fa-f0-9]{64}\b/
    hash: {
      type: 'string',
      // description:
      //   'base58 encoded hash hopefully with identifier at front, or UNKNOWN',
    },
    algorithm: {
      enum: ['sha256'],
    },
  },
}

const addressSchema = {
  title: 'Address',
  // description: `Hash of the Provenance of the first block in this chain,
  // with prefix, check digits, in base58`,
  type: 'object',
  additionalProperties: false,
  required: ['chainId', 'status'],
  properties: {
    chainId: integritySchema,
    status: {
      type: 'string',
      pattern: '^UNKNOWN$|^GENESIS_|^LOOPBACK$|^ROOT$|^RESOLVED$|^INVALID$',
    },
  },
}

const publicKeySchema = {
  title: 'PublicKey',
  // description: 'public key of a public / secret pair',
  type: 'object',
  additionalProperties: false,
  required: ['key', 'algorithm'],
  properties: {
    // TODO format checks to set fixed length based on algo
    key: { type: 'string' },
    algorithm: { enum: ['tweetnacl', 'sodium', 'noble-secp256k1', '@@pierce'] },
  },
}

const signatureSchema = {
  title: 'Signature',
  // description: `A cryptographic signature of some detached integrity`,
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
  // description: `Proof of the Provenance of the object
  // referenced by signed integrity.
  // The integrity of the first provenance in a chain is the chainId.
  // When the provenance is inserted back into the dmz, the dmz becomes a Block.
  // The integrity which is signed is the integrity of the whole object,
  // minus "integrity" and "signatures" keys

  // Integrity can be a merkle proof so a set of chains with the same
  // validators can create signatures for the root hash, then distribute
  // to all the chains where each is blinded to the others in the merkle
  // proof.

  // Running chains internally is much faster than cross block boundaries.`,
  type: 'object',
  additionalProperties: false,
  required: [
    'dmzIntegrity',
    'height', // TODO why care about height in git like structures ?
    'address',
    'lineage',
    'integrity',
    'signatures',
  ],
  properties: {
    dmzIntegrity: integritySchema,
    address: addressSchema,
    lineage: {
      type: 'object',
      //     description: `Object of previous blockhashes this provenance item extends.
      // There may be many, but at least one is the most recent block provenance.
      // Others might be those resulting from overdrive consensus,
      // or periodic shortcutting of the chain history to quick lookup purposes.
      // Height must always be greater than any previous provenance for this address.
      // Provenance is monotonic, and should increment by 1 each time.

      // First lineage supplied to create defines the chainId of the result.

      // Provenance is a statement of authenticity and position in lineage.
      // Lineage is the chain of previous provenances.

      // Key gives the provenance id, which can be height, or foreignChain:height.
      // Value gives the hash of the block at the provenance id.`,
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
  // description: 'Interblock proof model.',
  type: 'object',
  additionalProperties: false,
  required: ['block'],
  properties: {
    block: { type: 'string' }, // TODO regex for hash string format
    network: { type: 'object' }, // concat of all channel hashes
    channel: { type: 'string' },
  },
}

const turnoverSchema = {
  title: 'Turnover',
  // description: `
  // Turnovers represent the new validator set being signed by the old validator set
  // While these are not hashed directly, they are not malleable and can quickly be
  // detected as corrupt as they must provide a path to the current provenance
  // from the genesis block, which gives us the address of the chain.`,

  // Must be a separate data structure, as this gets tacked onto the
  // side of an interblock.  It proves the change of validators being affirmed by
  // the previous validators.

  type: 'object',
  additionalProperties: false,
  required: ['provenance', 'proof', 'validators'],
  properties: {
    provenance: provenanceSchema,
    proof: proofSchema,
    validators: validatorsSchema,
  },
}

const remoteSchema = {
  title: 'Remote',
  // description: 'Slice of Channel state transmitted with an Interblock.
  // "precedent" is the blockhash of the interblock that came before this one,
  // or if new, points to the genesis block.  This hashing provides a
  // strong guarantees of untampered lines of transmission.
  type: 'object',
  additionalProperties: false,
  required: ['address', 'replies', 'requests', 'precedent'],
  properties: {
    address: addressSchema,
    replies: {
      type: 'object',
      // description: `Keys are of format blockheight_index`,
      additionalProperties: false,
      patternProperties: {
        '[0-9]+_[0-9]+': continuationSchema,
      },
    },
    requests: {
      type: 'array',
      uniqueItems: true,
      items: actionSchema,
    },
    precedent: integritySchema,
  },
}
const channelSchema = {
  title: 'Channel',
  // description: `Communication Queues.
  // These queues and their responses are what all interchain
  // communication seeks to facilitate.  All the cryptography
  // employed in this system is to reliably process these
  // queues.

  // Each connection side has a transmit and a receive.
  // Each connection side transmits requests and replies to the other.

  // Transmit = Sum( Channel )
  // Receive = Sum( Interblock( Channel ) )
  // Interblocks  = Channel + Provenance

  // The latest received channel is always stripped and placed in a temporary
  // structure in the dmz, for immediate processing.  All remote requests and
  // replies are always processed every blockmaking cycle.
  // Replies are always processed before incoming requests.

  // it is vital that all requests and replies follow a strict order, to
  // guarantee reproducibility

  // The queues hold the index for their next actions within them:
  // 1.  Next remote reply index is the smallest index of the transmit queue
  //     for which there is a remote reply that is not a promise
  // 2.  Next remote request index is given by the local highest reply index

  // If systemRole === '.' then provenance checks are excused, as the
  // networkProducer.tx() function will flip outbound and inbound.  This is used
  // in the loopback self channel.

  // Counter is required to know where the request counter is up to, which needs independent
  // tracking as the channel might be cleared completely, but we cannot reuse numbers until
  // looparound at 32bit limit or similar

  // "rxRepliesTip" is here to allow a fast lookup, else worst case we
  // may have to walk the entire chain of interblocks to affirm that the
  // counter was correct.

  // "tip" is the hash of the last interblock we received, which might be
  // unknown
  type: 'object',
  required: [...remoteSchema.required, 'systemRole'],
  additionalProperties: false,
  properties: {
    ...remoteSchema.properties,
    systemRole: { enum: ['..', '.', './', 'UP_LINK', 'DOWN_LINK', 'PIERCE'] },
    rxRepliesTip: {
      type: 'string',
      // description: Tracks where the remote channel inbound replies are `
      // up to as a check against remote errors`,
      pattern: '[0-9]+_[0-9]+',
    },
    tip: integritySchema, // TODO change to an array to minimize db hits
    tipHeight: {
      type: 'integer',
      //   description: `Lets interblocks be added quickly by testing height.
      // Later should be removed in favour of db lookups`,
      minimum: 0,
    },
  },
}
const interblockSchema = {
  title: 'Interblock',
  // description: `The fundamental unit of inter chain communication.
  // Contains provenance, a punched out DMZ, and one or more transmit channels
  // of the source chain.
  // This must be an model, so as to ensure we do not leak info, rather
  // than making it a special case of a BlockModel.
  // This cannot import dmzModel directly, as it is a fundamental
  // circular reference, as the outside depends on the inside.
  // This can only be made from a verified block.

  // Interblocks and turnovers are the only place that need punched out proofs.

  type: 'object',
  additionalProperties: false,
  required: ['provenance', 'proof', 'network'],
  properties: {
    provenance: provenanceSchema,
    network: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      patternProperties: {
        '(.*?)': remoteSchema,
        // TODO restructure to use chainId as key, as saves transmission space,
        // and can allow for more compact internal representation in the
        // network model
      },
    },
    proof: proofSchema,
    // TODO handle special case of turnover occuring at same time as transmit ?
    turnovers: { type: 'array', uniqueItems: true, items: turnoverSchema },
  },
}

export {
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
  turnoverSchema,
}
