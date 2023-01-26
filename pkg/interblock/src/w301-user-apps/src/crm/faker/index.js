import sectorsList from '../../../../../../../data/sectors.mjs'

export const routing = sectorsList.list.map((formData) => ({ formData }))

export * as customers from './customers'
