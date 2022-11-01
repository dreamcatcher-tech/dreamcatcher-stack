import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { Map } from '../components'
import Debug from 'debug'
import { Card, CardContent, Grid, Button } from '@mui/material'

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
export const CardOverDraw = (args) => {
  return (
    <>
      <Map>
        <Grid container>
          <Grid padding={3} item>
            <Card>
              <CardContent>This content should appear over the Map</CardContent>
            </Card>
          </Grid>
        </Grid>
      </Map>
    </>
  )
}
export const CardColumn = (args) => {
  return (
    <>
      <Map>
        <Grid container>
          <Grid padding={3} item>
            <Card style={{ minHeight: '200px' }}>
              <CardContent>Right hand side is draggable</CardContent>
            </Card>
          </Grid>
        </Grid>
      </Map>
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
  geoJson: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [175.238457, -37.723479],
            [175.202751, -37.749001],
            [175.252876, -37.746015],
            [175.238457, -37.723479],
          ],
        ],
      },
    },
  ],
}
