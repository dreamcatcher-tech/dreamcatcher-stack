import * as React from 'react'
import dayjs from 'dayjs'
import { Card, CardContent } from '@mui/material'
import TextField from '@mui/material/TextField'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:Date')

export default function Date({ dateString, onDateChange, children }) {
  debug('value', dateString)
  const parse = (date) => {
    const string = date.format('YYYY-MM-DD')
    debug(string)
    onDateChange(string)
  }
  return (
    <Card>
      <CardContent>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <StaticDatePicker
            value={dayjs(dateString)}
            onChange={parse}
            renderInput={(params) => {
              debug('renderInput', params)
              return <TextField {...params} />
            }}
            showDaysOutsideCurrentMonth
            componentsProps={{
              actionBar: {
                actions: ['today', 'meow'],
              },
            }}
          />
        </LocalizationProvider>
        {children}
      </CardContent>
    </Card>
  )
}
Date.propTypes = {
  dateString: PropTypes.string,
  onDateChange: PropTypes.func,
}
Date.today = () => {
  const now = dayjs()
  return now.format('YYYY-MM-DD')
}
