import { createRepo } from 'ipfs-repo'
import { createBackend } from './src/createBackend'
import { loadCodec } from './src/loadCodec'
const usedNames = new Set()
export const createRamRepo = (name) => {
  if (!name) {
    do {
      name = Math.random().toString(36).substring(2, 15)
    } while (usedNames.has(name))
    usedNames.add(name)
  }
  return createRepo(name, loadCodec, createBackend())
}
export * from './src/PulseNet'
export * from './src/NetEndurance'
export * from './src/Announcer'
