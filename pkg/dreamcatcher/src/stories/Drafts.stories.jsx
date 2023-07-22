import { generateDraftBatch } from '../covenants/faker'
import * as app from '../covenants/app'
import React from 'react'
import { play, EngineHOC } from '@dreamcatcher-tech/webdos'
import Debug from 'debug'
import { Drafts } from './Drafts'
import base64Image from './assets/base64Image'
const debug = Debug('dreamcatcher:Drafts')
const install = { add: { path: '/drafts', installer: '/dpkg/app/drafts' } }
const batch = { '/drafts/batch': { batch: generateDraftBatch(10) } }

export default {
  title: 'Dreamcatcher/Drafts',
  component: EngineHOC(Drafts, '*:Draft* iplog'),
  args: {
    dev: { '/dpkg/app': app },
    path: '/drafts',
  },
  play: play([install, batch]),
}

export const Basic = {}
export const Empty = { play: play([install]) }
export const Loading = { play: play([]) }
export const Create = {
  play: play([
    install,
    { '/drafts/createDraftHeader': { time: Date.now() } },
    { cd: { path: '/drafts/0' } },
  ]),
}
export const Mint = {
  play: play([
    install,
    { '/drafts/createDraftHeader': { time: Date.now() } },
    {
      '/drafts/0/set': {
        formData: { name: 'test', description: 'test', image: base64Image },
      },
    },
    { cd: { path: '/drafts/0' } },
  ]),
}
