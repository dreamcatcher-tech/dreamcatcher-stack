#!/usr/bin/env node

import { config } from 'dotenv'
import shell from '.'

const loaded = config({ path: '../../.env' })

if (loaded && loaded.parsed) {
  console.log('loaded .env:', Object.keys(loaded.parsed))
}
shell()
