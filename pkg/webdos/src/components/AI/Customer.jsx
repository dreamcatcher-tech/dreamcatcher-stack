import { Transactions, Services, Gps } from '..'
import { Crisp } from '@dreamcatcher-tech/interblock'
import Markdown from 'markdown-to-jsx'

import DialogTitle from '@mui/material/DialogTitle'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'

import React, { useState } from 'react'
import Debug from 'debug'
import PropTypes from 'prop-types'

const debug = Debug('AI:Customer')
const Customer = ({ crisp }) => {
  // this should be a markdown string
  const text = crisp?.state?.string || ''

  debug('customer', crisp)

  if (!crisp) {
    return null
  }

  // set another markdown file that lists what fields to hide
  // so like a template markdown that just describes all the fields we are using
  // and sets the default display rules for it
  // each user can customize this, and HAL should be aware of how the final
  // view is composed, so the user can alter it and have it explained to them

  debug('text', text)

  return (
    <Card>
      <CardHeader>meow</CardHeader>
      <CardContent>
        <Markdown wrapper="React.Fragment">{text}</Markdown>
      </CardContent>
    </Card>
  )
}
Customer.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

export default Customer
