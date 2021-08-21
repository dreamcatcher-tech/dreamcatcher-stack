import Debug from 'debug'
const debug = Debug('covenant')

const covenants = {
  projects: {
    reducer: (state, action) => {
      debug(`testCovenant reducer`, action)
      return {}
    },
    actions: {
      test: () => ({ type: 'TEST', payload: {} }),
      add: () => ({ type: 'ADD_PROJECT', payload: {} }),
    },
  },
  project: {
    reducer: (state, action) => {
      return {}
    },
    actions: {
      wish: () => ({ type: 'WISH' }),
    },
  },
  dreams: {
    reducer: (state, action) => {
      return {}
    },
    actions: {
      add: () => ({ type: 'WISH' }),
    },
  },
  dream: {
    reducer: (state, action) => {
      return {}
    },
    actions: {
      wish: () => ({ type: 'WISH' }),
    },
  },
  wishes: {
    reducer: (state, action) => {
      return {}
    },
    actions: {
      add: () => ({ type: 'ADD' }),
    },
  },
}

const projectSchema = {
  namePath: ['name'],
  covenant: 'Object',
  schema: {
    title: 'Project',
    description: 'A project is a blahbalhbalhbaasdfasdf',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      tweet: { type: 'string' }, // regex max 160 char
    },
  },
}

const scenario57 = () => {
  // assume you have a running dreamcatcher
  const dre = 'running dreamcatcher'
  dre.cd('projects')
  dre.add({ name: 'test1' })
  dre.cd('test1')
  dre.add({ name: 'myfirstwish' }, 'wishes')

  // i expect xasdfgasdfasdf
}

const installer = {
  children: {
    projects: {
      covenant: 'projects',
      children: {
        project: {
          covenant: 'project',
          state: {
            datumTemplate: {
              namePath: ['name'],
              schema: {
                title: 'Project',
                description: '(copy from dictionary)',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  tweet: { type: 'string' }, // regex max 160 char
                },
              },
              children: {
                dreams: {
                  covenant: 'dreams',
                  state: {
                    schema: {
                      title: 'Dreams',
                      description: '',
                      properties: {},
                    },
                  },
                },
                wishes: {
                  covenant: 'wishes',
                  state: {
                    schema: {
                      title: 'Wishes',
                      description: '',
                      properties: {},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    settings: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'Settings',
          type: 'object',
          required: ['isTerminalVisible'],
          additionalProperties: false,
          properties: {
            isTerminalVisible: {
              title: 'Show Terminal',
              type: 'boolean',
              default: true,
            },
            isGuiVisible: {
              title: 'Show GUI',
              type: 'boolean',
              default: true,
            },
            isFakeDataEnabled: {
              title: 'Allow Fake Data',
              type: 'boolean',
              default: true,
            },
          },
        },
      },
    },
    about: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'About CRM',
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
        formData: {
          title: 'CRM',
          description: 'Simple Customer Relationship Management',
        },
      },
    },
    account: {
      // TODO needs to link to self project
      covenant: 'datum',
      state: {
        schema: {
          title: 'Account',
          type: 'object',
          properties: {
            name: { title: 'Name', type: 'string' },
            email: {
              title: 'Email',
              type: 'string',
              format: 'email',
            },
          },
        },
      },
    },
  },
}

const covenantId = { name: 'dreamcatcher' }

export default { covenantId, installer, covenants }
