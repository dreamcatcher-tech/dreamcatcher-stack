import { generateDraftBatch } from '../covenants/faker'
import * as app from '../covenants/app'
import React from 'react'
import { play, EngineHOC } from '@dreamcatcher-tech/webdos'
import Debug from 'debug'
import { Drafts } from './Drafts'
const debug = Debug('dreamcatcher:Drafts')
const install = { add: { path: '/drafts', installer: '/dpkg/app/drafts' } }
const batch = { '/drafts/batch': { batch: generateDraftBatch(10) } }

export default {
  title: 'Dreamcatcher/Drafts',
  component: EngineHOC(Drafts, '*:Drafts iplog'),
  args: {
    dev: { '/dpkg/app': app },
    path: '/drafts',
  },
  play: play([install, batch]),
}

export const Basic = {}
export const Empty = { play: play([install]) }
export const Loading = { play: play([]) }
export const New = {
  play: play([
    install,
    { cd: { path: '/drafts/newHeader', allowVirtual: true } },
  ]),
}
