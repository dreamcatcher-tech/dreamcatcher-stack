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
  },
}
const Template = ({ initial }) => {
  Debug.enable('*Date')
  const [value, setValue] = useState(initial)
  const onChange = (date) => {
    setValue(date)
  }
  return <Date {...{ value, onChange }} />
}
Template.propTypes = { initial: PropTypes.string }

export const Basic = Template.bind({})
export const Tomorrow = Template.bind({})
Tomorrow.args = {
  initial: dayjs().add(1, 'day').format('YYYY-MM-DD'),
}
