import { useContext } from 'react'
import context from '../router/RouterContext'
export const useRouter = () => useContext(context)
