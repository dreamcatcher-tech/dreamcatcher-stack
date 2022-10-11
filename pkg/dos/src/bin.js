#!/usr/bin/env node

import { config } from 'dotenv'
import shell from '.'

console.log(config({ path: '../../.env' }))
shell()
