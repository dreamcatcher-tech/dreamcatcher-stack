import dayjs from 'dayjs'
import React from 'react'
import { useState } from 'react'
import { within, userEvent } from '@storybook/testing-library'
import Debug from 'debug'
import { Date } from '../components'
import PropTypes from 'prop-types'

export default {
  title: 'Date',
  component: Date,
  args: {
    initial: Date.today(),
    expanded: true,
  },
}
const Template = ({ initial, ...rest }) => {
  Debug.enable('*Date')
  const [dateString, setValue] = useState(initial)
  const onDateChange = (date) => {
    setValue(date)
  }
  return <Date {...{ ...rest, dateString, onDateChange }} />
}
Template.propTypes = { initial: PropTypes.string }

export const Basic = Template.bind({})
export const Tomorrow = Template.bind({})
Tomorrow.args = {
  initial: dayjs().add(1, 'day').format('YYYY-MM-DD'),
}
export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
