import { ethers } from 'ethers'
export const blockWatcher = async () => {
  const SILD = '0x2e00F977d778787d65bd303ADA2fde472C1d9158'
  const infura = { projectId: import.meta.env.VITE_INFURA_API_KEY }
  const provider = new ethers.getDefaultProvider(1, { infura })
  provider.on('block', (blockNumber) => {
    console.log('blockNumber', blockNumber)
  })

  const blockNumber = await provider.getBlockNumber()
  console.log('blockNumber', blockNumber)
}
