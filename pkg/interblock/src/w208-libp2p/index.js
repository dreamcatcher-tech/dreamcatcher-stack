import { createRepo } from 'ipfs-repo'
import { createBackend } from './src/createBackend'
import { loadCodec } from './src/loadCodec'

export const createRamRepo = (name) =>
  createRepo(name, loadCodec, createBackend())
export * from './src/PulseNet'
