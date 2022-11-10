import React from 'react'
import { Map } from '..'
import Debug from 'debug'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
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

const GlassContainer = ({ children }) => (
  <Grid
    container
    sx={{ zIndex: 1, position: 'relative', pointerEvents: 'none' }}
  >
    {children}
  </Grid>
)

const GlassLeft = ({ children }) => (
  <Grid padding={3} item sx={{ pointerEvents: 'auto' }}>
    {children}
  </Grid>
)

export const CardOverDraw = (args) => {
  return (
    <>
      <GlassContainer>
        <GlassLeft>
          <Card>
            <CardContent>This content should appear over the Map</CardContent>
          </Card>
        </GlassLeft>
      </GlassContainer>
      <Map />
    </>
  )
}
export const CardColumn = (args) => {
  return (
    <>
      <Map />
      <GlassContainer>
        <GlassLeft>
          <Card style={{ minHeight: '200px' }}>
            <CardContent>Right hand side is draggable</CardContent>
          </Card>
        </GlassLeft>
      </GlassContainer>
    </>
  )
}
export const NoPolygons = Template.bind({})
NoPolygons.args = {
  onCreate: undefined,
}
export const Polygons = Template.bind({})
// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
Polygons.args = {
  complex: faker.child('routing'),
  customers: false,
}

export const Customers = Template.bind({})
Customers.args = {
  complex: faker.child('routing'),
  showCustomers: true,
}
