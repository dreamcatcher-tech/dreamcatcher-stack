import dayjs from 'dayjs'
import React from 'react'
import { useState } from 'react'
import { within, userEvent } from '@storybook/testing-library'
import Debug from 'debug'
import { Date, Glass } from '..'
import PropTypes from 'prop-types'

export default {
  title: 'Date',
  component: Date,
  args: {
    runDate: Date.today(),
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
  runDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
}
export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
