/**
 * File types:
 *      ordinary files
 *      container files
 *      device / side effect files
 *
 * Rules
 *      1. In any directory, all commands are overridden by the app itself
 */

const email = {
  bin: {},
  Inbox: {},
  Outbox: {},
  Trash: {},
  Spam: {},
  Forums: {},
  Sent: {},
  Drafts: {},
  Archived: {},
  Templates: {},
}

const bigCasino = {
  games: {
    interblockDie: {
      bin: {
        send: {},
      },
    },
  },
}
const kyc = {}

const wallet = {
  bin: {
    bal: {},
    send: {},
    ls: {},
  },
}

const flowCreator = {
  bin: {
    add: {
      params: ['<object|stateMachine>'],
      description: 'add a new object or a new stateMachine',
      action: 'stateMachineId1',
    },
    addobject: {
      description: 'add a new object to the list of available objects',
      action: 'stateMachineId2',
    },
  },
}

const dreamcatcher = {
  projects: {
    chainId1: {
      title: 'Interblock',
      tweet: 'The blockchain model of distributed computing',
      config: {
        private: true,
      },
      demand: {},
      capital: {},
      tech: {},
      talent: {},
    },
    chainId2: {
      title: 'Dreamcatcher',
      tweet:
        'Mapping the Dreamscape, connecting all problems with all solutions using talent and capital to get there',
      demand: {},
      capital: {},
      tech: {},
      talent: {},
    },
  },
  dreamscape: {
    chainId1: {
      title: 'Atomic Precision Printer',
      tweet: '',
    },
    chainId2: {
      title: 'General Artificial Intelligence',
      tweet: '',
    },
    chainId2: {
      title: 'Invention Machine',
      tweet: '',
    },
    chainId3: {
      title: 'Classification of dreamscape items as Problems or Solutions',
      tweet:
        'Is there a need to describe any item in the dreamscape as a problem or a solution ?  Can something be both ?',
    },
  },
  layers: {
    chainId4: {
      title: 'ground',
      tweet: 'The one true layer, where money moves, and all projects exist',
    },
    chainId5: {
      title: 'dctheory',
      tweet: 'the shared project amongst all in our company',
    },
  },
}
const filesystem = {
  home: {},
  files: {},
  messages: {},
  assets: {
    // where tokenized ownership of things is placed - your inventory
    // can include pieces of technology that you want to license
  },
  contacts: {
    // your friends list by alias ?
    // when you sign up, import these from whatever social media you want
    // merge them all together and manage as a single thing
    // send messages to them all, get a merged feed update
  },
  account: {
    keys: {
      // special storage that will sign things but never expose its keys
      // hardware signing devices attach through here
    },
  },
  www: {}, // the static pages you present to the world that we host for you
  mnt: {
    // your conventional files on current machine
  },
  vms: {
    // other instantiations of this operating system under your control
  },
  opt: {
    email,
    flowCreator,
    dreamcatcher,
  },
}

module.exports = filesystem
