import templateUrl from './template.pdf?url'
import Debug from 'debug'
console.log('data', templateUrl)
const debug = Debug('webdos:stories:data')

const dataPrefix =
  'https://raw.githubusercontent.com/dreamcatcher-tech/crm-data/de2cc481276effbab55536e17e1d1e4f54c28617/'
const car = {
  blank: {
    url: dataPrefix + 'crm.blank.car',
    path: '/crm',
  },
}

export { templateUrl, car }
