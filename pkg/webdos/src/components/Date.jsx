import * as React from 'react'
import dayjs from 'dayjs'
import TextField from '@mui/material/TextField'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:Date')

export default function Date({ value, onChange }) {
  debug('value', value)
  const parse = (date) => {
    const string = date.format('YYYY-MM-DD')
    debug(string)
    onChange(string)
  }
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <StaticDatePicker
        value={dayjs(value)}
        onChange={parse}
        renderInput={(params) => {
          debug('renderInput', params)
          return <TextField {...params} />
        }}
        showDaysOutsideCurrentMonth
        componentsProps={{
          actionBar: {
            actions: ['today'],
          },
        }}
      />
    </LocalizationProvider>
  )
}
Date.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
}
Date.today = () => {
  const now = dayjs()
  return now.format('YYYY-MM-DD')
}
