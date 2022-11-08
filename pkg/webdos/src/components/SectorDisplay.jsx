import { api } from '@dreamcatcher-tech/interblock'
import * as React from 'react'
import PropTypes from 'prop-types'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import { Typography } from '@mui/material'
import { Sorter } from '.'
export default function SectorDisplay({ complex }) {
  if (!complex) {
    return <NotSelected />
  }
  const { formData } = complex.state
  const { name, frequencyInDays, frequencyOffset, order } = formData
  // TODO resolve order to full customer names
  const items = order.map((custNo) => {
    return { path: custNo }
  })
  return (
    <Card sx={{ minWidth: 275 }}>
      <CardHeader title={'Sector: ' + name} />
      <CardContent>
        <Typography>Frequency in Days: {frequencyInDays}</Typography>
        <Typography>Frequency Offset: {frequencyOffset}</Typography>
        <Typography variant="h6">Customers:</Typography>
        <Sorter complex={complex} readonly />
      </CardContent>
    </Card>
  )
}
SectorDisplay.propTypes = {
  complex: PropTypes.instanceOf(api.Complex),
}
const NotSelected = () => {
  return (
    <Card>
      <CardHeader title="No sector selected" />
      <CardContent>
        <Typography>Select a sector to see details.</Typography>
      </CardContent>
    </Card>
  )
}
