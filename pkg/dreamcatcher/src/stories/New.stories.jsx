import * as app from '../covenants/app'
import { Datum, EngineHOC } from '@dreamcatcher-tech/webdos'
const init = [{ add: { path: '/app', installer: '/dpkg/app' } }]
import './shim'
import { SDK, Auth, Metadata, TEMPLATES } from '@infura/sdk'
import { MetaMaskSDK } from '@metamask/sdk'
const MMSDK = new MetaMaskSDK()
import { ethers } from 'ethers'
const SILD = '0x2e00F977d778787d65bd303ADA2fde472C1d9158'

export default {
  title: 'Dreamcatcher/New',
  component: EngineHOC(Datum),
  tags: ['autodocs'],
  args: { dev: { '/dpkg/app': app }, init, path: '/app' },
}

export const Primary = {
  args: {},
}

const infura = { projectId: import.meta.env.VITE_INFURA_API_KEY }
const provider = new ethers.getDefaultProvider(1, { infura })

provider.on('block', (blockNumber) => {
  console.log('blockNumber', blockNumber)
})

const blockNumber = await provider.getBlockNumber()
console.log('blockNumber', blockNumber)

// listen to events on the contract and use this to make new calls to get
// metadata from the nft api.

// // CREATE CONTRACT Metadata
// const collectionMetadata = Metadata.openSeaCollectionLevelStandard({
//   name: 'My awesome collection',
//   description: "A long description explaining why it's awesome",
//   image: '',
//   external_link: 'https://myawesomewebsite.net',
// })
