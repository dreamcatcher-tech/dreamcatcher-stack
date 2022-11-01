import Debug from 'debug'
import React from 'react'
import { useState } from 'react'
import PropTypes from 'prop-types'
import { Map } from '.'
import { Grid, Card, CardContent, Stack } from '@mui/material'
import dayjs from 'dayjs'
import { TextField } from '@mui/material'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker'
import { Date } from '.'
const debug = Debug('terminal:widgets:Routing')

/**
 * NEW:
 *    Immediately calculates what customers are members
 * VIEW:
 *    Click on the polygons to select a sector
 *    Show the stats for the sector as a datum
 *    Nothing selected shows the default sector
 * EDIT:
 *    Editing the datum - opens up the normal edit datum tools
 *    Allows DND for the sorter
 */

const Routing = ({}) => {
  const onCreate = () => {}
  const onEdit = () => {}
  return (
    <>
      <Map {...{ onCreate, onEdit }}>
        <Stack spacing={2}>
          <Card sx={{ minWidth: 245 }}>
            <CardContent>
              <div>meow</div>
              {/* <Actions actions={actions}></Actions> */}
            </CardContent>
          </Card>
        </Stack>
      </Map>
    </>
  )
}
Routing.propTypes = {
  // this is a test
  test: PropTypes.string,
}
Routing.defaultProps = { test: 'm' }

export default Routing
