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
    chainId3: {
      title: 'Invention Machine',
      tweet: '',
    },
    chainId4: {
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

/**
 * Example set of commands:
    // to add a project
    cd /apps/dreamcatcher/projects
    ./add --name 'HelloProject' --attribution { algo: 'hotpath' } 
    ls // HelloProject
    ./add --name 'HelloProject2' --attribution { algo: 'hotpath' } 
    ls // HelloProject, HelloProject2
    cd HelloProject/issues
    ./add --title 'Huge glaring problem'
    ls // 1 
    ./add --title 'Minor chore'
    ls // 1, 2
    cat 1 // { title: 'Huge glaring problem', description: '' }
    ./edit 1 --title 'less huge problem'
    cat 1 // { title: 'less huge problem', description: '' }

    /apps/dreamcatcher/addresses/add Barney --chainId 0x2f2324...

    cd /apps/dreamcatcher/projects
    ./mv HelloProject Barney

    cat / // validators would your personal validators
    whoami // Charlie, chainId

    / (your computer)
      apps/
        appStoreBrowser/
          crm/ // chainId that holds the install package of the crm app
          dreamcatcher/
          weather/
        appStoreRegistry/
        dreamcatcher/
          projects/
        crm/
        networkDiscover/ // an app to find other computers
      dev/
        tty1/ // this browser
        tty2/ // this browser on a new tab
        tty3/ // your mobile phone
      home/
        user1/ //"my identiy 1", --chainId 0x2f2324...
        user2/ // "my evil side" --chainId 0x2d986f2324...
          connections/
      myhalfassesrojects/
        halfass1/ // ln -s /apps/dreamcatcher/projects/halfass1
      mnt/
        BarneysDOS/ // ln -s 0x2342edf42
      
cd apps
./install /appStoreBrowser/crm
ls /apps // ...., crm
cd /apps/crm
./connect BarneysCrm
./add --name MyNewCrm
./add --name MyNewCrm2
ls // MyNewCrm, MyNewCrm2, BarneysCrm -> /mnt/BarneysDOS 
/apps/appStoreBrowser/find crm* //BarneyXcrm: chainIDXXX
/apps/appStoreBrowser/install BarneyXcrm 
ls /apps // appStoreBrowser, ... dreamcatcher, BarneyXcrm
/apps/appStoreBrowser/find facebook // tractorbook, trumpbook, facebook
/apps/appStoreBrowser/install trumpbook
ls /apps // appStoreBrowser, ... dreamcatcher, BarneyXcrm, trumpbook
/apps/trumpbook/find Donald // Donald Rumsfeld, Donald Trump
/apps/trumpbook/add 'Donald Trump'
/apps/trumpbook/publish --identity 'user2' // links to chainid 0x2d986f2324...

/apps/appStoreBrowser/publish issuecat --path /tmp/issuecat
// ? how the fuck do you spec which app it works on ?
cd /apps/issuecat
./linkDreamcatcher /apps/dreamcatcher // throw error if not actually a dreamcatcher object
cd projects
cd ../issues // ln -s /apps/dreamcatcher/issues
ls // 1, 2
cat 1 2 
ls /apps/dreamcatcher/projects/HelloProject/issues // 1, 2, 3
ls /apps/dreamcatcher/plugins // issuecat, anycat, bounty

ls /apps/dreamcatcher/telemetry // 0x2223ed, spy.nsa.com/incoming

cat /apps/appStoreBrowser/issuecat/installer // here would be the .js files that it ran
ls /apps/appStoreBrowser/issuecat // installer, storefront, project -> .../dreamcatcher/projects

scp ./index.js /apps/dreamcatcher/projects/issuecat/files/index.js

 */
