import { JSONSchemaFaker } from 'json-schema-faker'
import { faker } from '@faker-js/faker/locale/en_AU'
import Debug from 'debug'
import template from './template'
const debug = Debug('dreamcatcher:faker')

faker.seed(0)
JSONSchemaFaker.extend('faker', () => faker)
JSONSchemaFaker.option('random', () => {
  const random = faker.string.numeric()
  return random
})
const time = () => {
  const dates = faker.date.recent()
  return dates.getTime()
}
const changeFunds = () =>
  faker.helpers.maybe(() => faker.number.int({ min: 0, max: 500 }))
const packetFunds = () =>
  faker.helpers.maybe(() => faker.number.int({ min: 0, max: 15000 }))
let changeId = 1

export const reset = (seed = 0) => {
  faker.seed(seed)
  changeId = 1
}

const generateFormData = () => {
  const { schema } = template
  const formData = JSONSchemaFaker.generate(schema)
  if (!formData.prompt) {
    delete formData.style
  } else {
    formData.style = faker.helpers.arrayElement(schema.properties.style.enum)
  }
  return formData
}

export const packet = () => {
  const formData = generateFormData()
  formData.changeId = changeId++
  formData.status = 'draft'
  formData.type = 'packet'
  formData.time = time()
  formData.funds = packetFunds()
  if (!formData.funds) {
    delete formData.funds
  }
  return { formData }
}

export const generatePacketBatch = (count = 20, noReset = false) => {
  if (!noReset) {
    reset()
  }
  const batch = []
  for (let i = 0; i < count; i++) {
    batch.push(packet())
  }
  return batch
}

export const draft = () => {
  const { schema } = template
  const formData = generateFormData()
  formData.changeId = 0
  formData.status = 'draft'
  const types = schema.properties.type.enum.filter((v) => v !== 'packet')
  formData.type = types[faker.number.int({ min: 0, max: types.length - 1 })]
  formData.time = time()
  delete formData.funds
  formData.image =
    faker.helpers.maybe(() => faker.image.url()) ||
    'https://dreamcatcher.land/img/dreamcatcher.svg'
  return { formData }
}

export const generateDraftBatch = (count = 20, noReset = false) => {
  if (!noReset) {
    reset()
  }
  const batch = []
  for (let i = 0; i < count; i++) {
    batch.push(draft())
  }
  return batch
}

export const change = () => {
  const { schema } = template
  const formData = generateFormData()
  formData.changeId = changeId++
  const statii = schema.properties.status.enum.filter((v) => v !== 'draft')
  formData.status = statii[faker.number.int({ min: 0, max: statii.length - 1 })]
  const types = schema.properties.type.enum.filter((v) => v !== 'packet')
  formData.type = types[faker.number.int({ min: 0, max: types.length - 1 })]
  formData.time = time()
  formData.funds = changeFunds()
  if (!formData.funds) {
    delete formData.funds
  }
  return { formData }
}

export const generateChangeBatch = (count = 20, reset = false) => {
  if (reset) {
    reset()
  }
  const batch = []
  for (let i = 0; i < count; i++) {
    batch.push(change())
  }
  return batch
}
