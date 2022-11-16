import React from 'react'
import { Map, Glass } from '..'
import Debug from 'debug'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import { apps } from '@dreamcatcher-tech/interblock'
const { faker } = apps.crm

export default {
  title: 'Map',
  component: Map,
  parameters: { layout: 'fullscreen' },
  args: {
    onCreate: (geoJson) => {
      console.log('create', geoJson)
    },
    onEdit: (geoJson) => {
      console.log('edit', geoJson)
    },
    onSector: (sector) => {
      console.log('sector', sector)
    },
    onMarker: (marker) => {
      console.log('marker', marker)
    },
  },
}
const wrap = (children) => {
  Debug.enable('*Map')

  return (
    <div
      style={{
        minHeight: '320px',
        width: '100%',
        height: '100%',
        background: 'purple',
        display: 'flex',
      }}
    >
      {children}
    </div>
  )
}
const Template = (args) => wrap(<Map {...args} />)

export const Basic = Template.bind({})

export const OverDraw = (args) => {
  const button = (
    <Button sx={{ bgcolor: 'red', height: 30, m: 5 }}>TEST BUTTON</Button>
  )
  return wrap(
    <>
      <Map {...args} />
      {button}
      {button}
    </>
  )
}

export const CardOverDraw = (args) => {
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <Card>
            <CardContent>This content should appear over the Map</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map />
    </>
  )
}
export const CardColumn = (args) => {
  return (
    <>
      <Map />
      <Glass.Container>
        <Glass.Left>
          <Card style={{ minHeight: '200px' }}>
            <CardContent>Right hand side is draggable</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
    </>
  )
}
export const NoPolygons = Template.bind({})
NoPolygons.args = {
  onCreate: undefined,
}

const complex = faker().child('routing')
export const Polygons = Template.bind({})
// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
Polygons.args = {
  complex,
}

export const Customers = Template.bind({})
Customers.args = {
  complex,
  markers: true,
}
export const ClickSectors = (args) => {
  const [selected, setSelected] = React.useState()
  return (
    <div>
      <Glass.Container>
        <Glass.Left>
          <Card>
            <CardContent>Selected:{selected}</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map onSector={setSelected} complex={complex} />
    </div>
  )
  // TODO script some actual clicking
}
export const ClickCustomers = (args) => {
  const [selected, setSelected] = React.useState()
  return (
    <div>
      <Glass.Container>
        <Glass.Left>
          <Card>
            <CardContent>Selected:{selected}</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map onMarker={setSelected} complex={complex} markers />
    </div>
  )
  // TODO script some actual clicking
}
