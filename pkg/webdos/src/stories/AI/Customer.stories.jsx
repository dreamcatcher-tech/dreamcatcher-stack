import PropTypes from 'prop-types'
import React from 'react'
import { Engine, Syncer } from '../..'
import Customer from '../../components/AI/Customer'
import { apps, Crisp } from '@dreamcatcher-tech/interblock'
import play from '../../Interactions'
import Debug from 'debug'
const debug = Debug('Customer')
const { faker } = apps.crm
faker.customers.reset()
const customer = faker.customers.generateSingle()
const record = `
# 📇 Customer Record

## 🙍 Personal Information
- **Name:** John Doe 🧑
- **Date of Birth:** 1985-04-23 🎂
- **Gender:** Male ♂️
- **Email:** johndoe@email.com 📧
- **Phone:** +1 234-567-8901 📱

## 🏠 Address
- **Street:** 1234 Maple Drive 🌳
- **City:** Springfield 🌆
- **State:** IL 🇺🇸
- **Zip Code:** 62704 📮
- **Country:** USA 🗽

## 🛍️ Purchase History
1. **Order ID:** 1001 🛒
   - **Date:** 2023-09-15 📅
   - **Items:** 
     - Ultra HD TV 55" 📺
     - Wireless Headphones 🎧
   - **Total:** $1200.00 💵

2. **Order ID:** 1023 🛒
   - **Date:** 2023-12-03 📅
   - **Items:** 
     - Smartphone Model X 📱
     - Protective Case 📦
   - **Total:** $800.00 💰

## 🌟 Customer Preferences
- Preferred Contact Method: Email 📧
- Newsletter Subscription: Yes ✅
- Loyalty Program Member: Yes 👍


`

const steps = [
  {
    '/add': { path: 'customer1', installer: { state: { string: record } } },
  },
]
export default {
  title: 'AI',
  component: Customer,
  args: {
    path: '/',
  },
}

const Template = (args) => {
  Debug.enable('iplog *Datum *Customer *Gps *Map *Interactions')
  debug(customer)
  return (
    <Engine>
      <Syncer path="/customer1">
        <Customer />
      </Syncer>
    </Engine>
  )
}

export const CustomerView = Template.bind({})
CustomerView.play = play(steps)
