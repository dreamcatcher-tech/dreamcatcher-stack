export const api = {
  ping: {
    type: 'object',
    title: 'PING',
    description: 'Ping a remote chain',
    additionalProperties: true,
    required: [],
    properties: {
      to: { type: 'string', default: '.' },
      message: { type: 'object', default: {} },
    },
  },
  login: {
    type: 'object',
    title: 'LOGIN',
    description: `Authenticate with a remote app complex
  Loop the user through a signon process that links
  The current machine pubkey to their interblock user chain.
  When this occurs, the guest chain will transition to the
  user chain, and the prompt will change from "guest" to "user"
      `,
    additionalProperties: false,
    required: ['chainId', 'credentials'],
    properties: {
      chainId: { type: 'string' }, // TODO regex
      credentials: { type: 'object' },
    },
  },
  add: {
    type: 'object',
    title: 'ADD',
    description: `Add a new chain at the optional path, with optional given installer.  If no path is given, a reasonable default will be automatically generated`,
    additionalProperties: false,
    required: [],
    properties: {
      // TODO interpret datums and ask for extra data
      path: { type: 'string' }, // TODO regex
      installer: {
        oneOf: [
          { type: 'string', description: 'Name of covenant to use' },
          {
            type: 'object',
            description: 'Installer object to use',
            default: {},
          },
        ],
      }, // TODO use pulse to validate format
    },
  },
  ls: {
    type: 'object',
    title: 'LS',
    description: `List all children, and any actions available in the chain at the given path`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
      all: {
        type: 'boolean',
        default: false,
        description: `List all children, including hidden ones that start with a dot`,
      },
      schema: {
        type: 'boolean',
        default: false,
        description: `List the schema of each child at the given path`,
      },
      state: {
        type: 'boolean',
        default: false,
        description: `List the state of each child at the given path`,
      },
      description: {
        type: 'boolean',
        default: false,
        description: `List the description held in the schema of each child at the given path`,
      },
    },
  },
  rm: {
    type: 'object',
    title: 'RM',
    description: `Attempt to remove the chain at the given path, and all its children`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
      history: {
        type: 'boolean',
        default: false,
        description: `Remove the history too`,
      },
      force: {
        type: 'boolean',
        default: false,
        description: `Do not allow any cleanup for the child tree`,
      },
    },
  },
  cd: {
    type: 'object',
    title: 'CD',
    description: `Change directory to the given path`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
      allowVirtual: {
        type: 'boolean',
        title: 'Allow Virtual Paths',
        description: `Allow wd to be set to a path that does not exist.
        This will be interpreted by the developer to mean something,
        much as virtual routing works for URLs in web apps`,
        default: false,
      },
    },
  },
  dispatch: {
    type: 'object',
    title: 'DISPATCH',
    description: `Dispatch an action to a remote chain`,
    additionalProperties: false,
    required: ['action', 'path'],
    properties: {
      action: {
        type: 'object',
        description:
          'The action that will be dispatched into the target chain at the given path.  This action must match the json-schema advertised by the api of the target, where the type of the action is the title of the schema, and the payload complies with the properties the schema defines',
        required: ['type', 'payload'],
        additionalProperties: false,
        properties: { type: { type: 'string' }, payload: { type: 'object' } },
      },
      path: { type: 'string', description: '', default: '.' }, // TODO regex
    },
  },
  publish: {
    type: 'object',
    title: 'PUBLISH',
    description: `Make a covenant ready for consumption`,
    additionalProperties: false,
    required: ['name', 'covenant', 'parentPath'],
    properties: {
      name: { type: 'string', description: `A friendly hint for consumers` }, // TODO regex to ensure no path
      covenant: {
        type: 'object',
        description: `The state of the pulished covenant chain`,
        // TODO use covenant state regex
      },
      parentPath: {
        type: 'string',
        default: '.',
        description: `Path to the publication chain.  You must have permission to update this chain.  If the path does not exist but the parent does, a new default child will be created`,
      }, // TODO regex
    },
  },
  cat: {
    type: 'object',
    title: 'CAT',
    description: `Return the state as an object at the given path`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
    },
  },
  ln: {
    type: 'object',
    title: 'LN',
    description: `Link to target path.
        Linking is act of inserting one Object as the child of another
        which allows an Object to be the child of more than one parent.
        This operation is essential to application data structures
        as opposed to simple filesystem data structures, which are 
        usually a tree`,
    additionalProperties: false,
    required: ['target'],
    properties: {
      target: { type: 'string' },
      linkName: {
        type: 'string',
        description: `defaults to the target name.  Must not have any pathing`,
      },
    },
  },
  bootHal: {
    type: 'object',
    title: 'BOOT_HAL',
    description: `Boot the HAL assistant`,
    additionalProperties: false,
    required: [],
    properties: {},
  },
  validators: {
    type: 'object',
    title: 'VALIDATORS',
    description: `
      View, change the validator set of a chain or group of chains.
      Recursively change all validators of the chains children.
      Validators must accept the role before the handover is complete.
      Can be used to force a change if a chain has stalled.
      `,
    properties: {},
    additionalProperties: false,

    // TODO make this a subset of all ACL type of operations
  },
  insert: {
    type: 'object',
    title: 'INSERT',
    description: `Insert a new child at the given path using the given PulseId`,
    additionalProperties: false,
    required: ['pulseId'],
    properties: {
      pulseId: { type: 'string' }, // TODO regex for pulseId
      path: { type: 'string', default: '.' },
    },
  },
  //   MV: 'moveActor',
  //   LOGOUT: 'logout',
  //   EXEC: 'execute',
  //   BAL: 'balance',
  //   EDIT: 'edit' // interprets datum and asks for input data
  //   MERGE: 'merge' // combine one chain into the target chain
  //   CP: 'copy' // fork a chain and give it a new parent
}
