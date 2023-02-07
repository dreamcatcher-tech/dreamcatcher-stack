// import React from 'react'
// import Debug from 'debug'
// import { apps } from '@dreamcatcher-tech/interblock'
// import { runSheetPdf, saveToUrl } from '../pdfs'
// import PropTypes from 'prop-types'
// import { useAsync } from 'react-async-hook'
// const debug = Debug('PdfRunSheet')
// const { crm } = apps
// const runDate = '2022-11-01'
// // TODO get consistent data
// const complex = crm.utils.generateManifest(crm.faker(200), runDate)
// const sector = complex.child(complex.network[0].path)

// export default {
//   title: 'PDF Manifest',
//   args: {
//     sector,
//   },
// }

// const Template = ({ sector }) => {
//   Debug.enable('*PdfRunSheet ')
//   debug('sector', complex)
//   const [url, setUrl] = React.useState()
//   useAsync(async () => {
//     const pdf = await runSheetPdf(sector, runDate)
//     const { url, size } = await saveToUrl(pdf)
//     debug('size', size)
//     setUrl(url)
//   })
//   if (!url) {
//     return <div>Loading...</div>
//   }
//   return <iframe src={url} width={'100%'} height={'100%'} />
// }
// Template.propTypes = { sector: PropTypes.object }

// export const Basic = Template.bind({})

// export const MultiPage = Template.bind({})
// const defaultRow = {
//   isDone: false,
//   ebc: false,
//   nabc: false,
//   isGateLocked: false,
//   isFenced: false,
//   isDog: false,
//   isVehicleBlocking: false,
// }
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
