import { packet } from './faker'
describe('faker', () => {
  test('generate', () => {
    let output
    let i = 0
    do {
      i++
      output = packet()
    } while (!output.formData.style && i < 100)
    expect(output.formData.style).toBeTruthy()
  })
})
