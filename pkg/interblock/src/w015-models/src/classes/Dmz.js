export class Dmz {
  schema = {
    type: 'object',
    title: 'Dmz',
    //   description: `DMZ coordinates all the models in one place.
    // Dmz is equivalent to CombineReducers in Redux.
    // "meta" is a state slice for use by the dmz to track outstanding promises`,
    required: [
      'validators', // interblock
      'encryption', // interblock
      // TODO turn back on for prod, or set by first validator block
      // 'timestamp', // interblock
      'config',
      'network', // interblock
      'covenantId',
      'binaryIntegrity',
      'acl',
      'state',
      'meta',
      'pending',
    ],
    additionalProperties: false,
    properties: {
      validators: validatorsModel.schema,
      encryption: keypairModel.schema,
      config: configModel.schema,
      covenantId: covenantIdModel.schema,
      binaryIntegrity: binaryModel.schema,
      timestamp: timestampModel.schema,
      acl: aclModel.schema,
      network: networkModel.schema, // grows and churns slowly
      state: stateModel.schema, // wildcard
      meta: metaModel.schema, // high churn
      pending: pendingModel.schema, // grows
      piercings: piercingsModel.schema, // transient
      // TODO add version ?
    },
  }
  constructor(opts = {}) {
    assert(typeof opts === 'object')
    this.validators = new Validators(opts.validators)
    this.encryption = new Keypair(opts.encryption)
    this.config = new Config(opts.config)
    this.covenantId = new CovenantId(opts.covenantId)
    this.binaryIntegrity = new BinaryIntegrity(opts.binaryIntegrity)
    this.timestamp = new Timestamp(opts.timestamp)
    this.acl = new Acl(opts.acl)
    this.network = new Network(opts.network)
    this.state = new State(opts.state)
    this.meta = new Meta(opts.meta)
    this.pending = new Pending(opts.pending)
    this.piercings = new Piercings(opts.piercings)
  }
  set(key, value) {
    // assert the key is one of the allowed keys
    // assert the value is one of the mapped classes
    // do sanity checks on things like pierce
  }
  diff() {
    // generates a list of ops for its children
    // then shifts the path of those ops one level deeper
    // returns a set of ops that can transform a plain js object
  }
  patch(opsList) {
    // splits all the ops and passes them to its children
    // after downshifting the paths
  }
}
