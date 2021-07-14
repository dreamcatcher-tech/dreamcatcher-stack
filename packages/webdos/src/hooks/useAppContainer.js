import { useContext } from 'react'
import { AppContainerContext } from '../components/AppContainer'
export const useAppContainer = () => useContext(AppContainerContext)
