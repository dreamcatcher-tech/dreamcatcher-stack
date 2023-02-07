import dayjs from 'dayjs'
import React from 'react'
import { useState } from 'react'
import Debug from 'debug'
import { Date, Glass } from '../components'
import PropTypes from 'prop-types'

const runDate = '2022-12-28'

export default {
  title: 'Date',
  component: Date,
  args: {
    runDate,
    expanded: true,
  },
}
const Template = ({ runDate, ...rest }) => {
  Debug.enable('*Date')
  const [dateString, setValue] = useState(runDate)
  const onDateChange = (date) => {
    setValue(date)
  }
  return (
    <Glass.Container>
      <Glass.Left>
        <Date {...{ ...rest, onDateChange }} runDate={dateString} />
      </Glass.Left>
    </Glass.Container>
  )
}
Template.propTypes = { runDate: PropTypes.string }

export const Basic = Template.bind({})
export const Tomorrow = Template.bind({})
Tomorrow.args = {
  runDate: dayjs(runDate).add(1, 'day').format('YYYY-MM-DD'),
}
export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
