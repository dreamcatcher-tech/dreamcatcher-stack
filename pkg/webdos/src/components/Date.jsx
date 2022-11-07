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
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useEffect } from 'react'
const debug = Debug('webdos:Date')

export default function Date({ runDate, onDateChange, expanded }) {
  debug('value', runDate)
  const parse = (date) => {
    const string = date.format('YYYY-MM-DD')
    debug(string)
    onDateChange(string)
  }
  const onChange = (event, expanded) => {
    debug('onChange', expanded)
  }
  return (
    <Card>
      <Accordion defaultExpanded={expanded} onChange={onChange}>
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
                componentsProps={{
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
  expanded: PropTypes.bool,
}
Date.today = () => {
  const now = dayjs()
  return now.format('YYYY-MM-DD')
}
