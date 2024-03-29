import * as React from 'react'
import dayjs from 'dayjs'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:Date')

export default function Date({ runDate, onDateChange, expanded }) {
  debug('value', runDate)
  const parse = (date) => {
    const string = date.format('YYYY-MM-DD')
    debug(string)
    onDateChange(string)
  }
  return (
    <Card>
      <Accordion defaultExpanded={expanded}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Date: {runDate}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <CardContent>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <StaticDatePicker
                value={dayjs(runDate)}
                onChange={parse}
                renderInput={(params) => {
                  debug('renderInput', params)
                  return <TextField {...params} />
                }}
                showDaysOutsideCurrentMonth
                slotProps={{
                  actionBar: {
                    actions: ['today'],
                  },
                }}
              />
            </LocalizationProvider>
          </CardContent>
        </AccordionDetails>
      </Accordion>
    </Card>
  )
}
Date.propTypes = {
  runDate: PropTypes.string,
  onDateChange: PropTypes.func,

  /**
   * If true, the component is shown expanded.
   */
  expanded: PropTypes.bool,
}
Date.nearestWeekday = () => {
  let now = dayjs()
  while (now.day() === 0 || now.day() === 6) {
    now = now.add(1, 'day')
  }
  return now.format('YYYY-MM-DD')
}
