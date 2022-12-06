import { api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import * as React from 'react'
import PropTypes from 'prop-types'
import {
  SorterDatum,
  Map,
  RoutingSpeedDial,
  SectorSelector,
  Datum,
  Glass,
} from '.'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

const debug = Debug('terminal:widgets:Routing')

const Routing = ({ complex, selected: initialSelected }) => {
  const onCreate = () => {}
  const onEdit = () => {}
  const [selected, onSelected] = React.useState(initialSelected)
  const sector = complex.hasChild(selected)
    ? complex.child(selected)
    : undefined
  if (!sector && complex.network.length) {
    onSelected(complex.network[0].path)
  }
  const onSector = onSelected
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <SectorSelector {...{ complex, selected, onSelected }} />
          {sector && (
            <>
              <Datum complex={sector} collapsed />
              <SorterDatum {...{ complex: sector, selected, onSelected }} />
            </>
          )}
        </Glass.Left>
      </Glass.Container>
      <RoutingSpeedDial></RoutingSpeedDial>
      <Map {...{ onCreate, onEdit, complex, onSector, selected }} markers />
    </>
  )
}
Routing.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  selected: PropTypes.string,
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

export default Routing
