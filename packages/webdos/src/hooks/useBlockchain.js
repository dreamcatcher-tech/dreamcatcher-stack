import { useContext } from 'react'
import { BlockchainContext } from '../Blockchain'

export const useBlockchain = () => useContext(BlockchainContext)
