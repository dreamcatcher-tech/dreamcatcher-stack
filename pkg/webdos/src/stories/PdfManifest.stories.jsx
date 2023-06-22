import React from 'react'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import { runSheetPdf, saveToUrl } from '../pdfs'
import PropTypes from 'prop-types'
import { useAsync } from 'react-async-hook'
const debug = Debug('PdfRunSheet')
const { crm } = apps
const runDate = '2022-11-01'
// TODO get consistent data

export default {
  title: 'PDF Manifest',
  args: {},
}

const Template = ({ sector }) => {
  Debug.enable('*PdfRunSheet *pdfs')
  const [url, setUrl] = React.useState()
  useAsync(async () => {
    try {
      const pdf = await runSheetPdf(sector, runDate)
      debug('pdf', pdf)
      const { url, size } = await saveToUrl(pdf)
      debug('size', size)
      setUrl(url)
    } catch (error) {
      console.error(error)
    }
  })
  if (!url) {
    return <div>Loading...</div>
  }
  return <iframe src={url} width={'100%'} height={'100%'} />
}
Template.propTypes = { sector: PropTypes.object }

export const Basic = Template.bind({})

export const MultiPage = Template.bind({})
const defaultRow = {
  isDone: false,
  ebc: false,
  nabc: false,
  isGateLocked: false,
  isFenced: false,
  isDog: false,
  isVehicleBlocking: false,
}
// const rows = complex.tree
//   .child('customers')
//   .network.map(({ path, state: { formData } }) => ({
//     ...defaultRow,
//     id: path,
//     address: formData.serviceAddress,
//   }))
// MultiPage.args = {
//   sector: sector.setState({
//     ...sector.state,
//     formData: { ...sector.state.formData, rows },
//   }),
// }
