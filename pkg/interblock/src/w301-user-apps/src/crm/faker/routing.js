import sectorsList from '../../../../../../../data/sectors.mjs'
export const generateSingle = (index = 0) => {
  const formData = sectorsList.list[index % sectorsList.list.length]
  return { formData }
}

export const generateBatch = (count = sectorsList.list.length) => {
  const batch = []
  for (let i = 0; i < count; i++) {
    const sector = generateSingle(i)
    batch.push(sector)
  }
  return batch
}
