import templateUrl from './template.pdf'
import Debug from 'debug'
import sectorsList from '../../../../../data/sectors.mjs'

const debug = Debug('webdos:stories:data')

const dataPrefix =
  'https://raw.githubusercontent.com/dreamcatcher-tech/crm-data/de2cc481276effbab55536e17e1d1e4f54c28617/'
const car = {
  blank: {
    url: dataPrefix + 'crm.blank.car',
    path: '/crm',
  },
}
export const sectors = sectorsList.list.map((formData) => ({ formData }))

export { templateUrl, car }
