import Button from '@mui/material/Button'
import Stack from '@mui/system/Stack'
import React from 'react'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
const { crm } = apps
const runDate = '2022-11-09'
const complex = crm.utils.generateManifest(crm.faker(), runDate)

// generate a manifest in pdf form
// make this be a hook that is null until the pdf is ready to open

// takes an invoice template, a manifest object, and the customers complex
// produces a pdf document which can be opened in a new tab

export default {
  title: 'PDF Manifest',
  // component: PdfManifest,
  args: {
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*PdfManifest')
  return <div />
}

export const Basic = Template.bind({})

export const Open = (args) => {
  Debug.enable('*PdfManifest')
  // TODO put in the blob url

  // make new tab open with the blob url in place
  const document = <PdfManifest {...args} />
  const [instance, update] = usePDF({ document })
  if (instance.loading) {
    return <div>Loading...</div>
  }
  return (
    <Stack maxWidth={175}>
      <Button
        variant="contained"
        onClick={() => window.open(instance.url, 'PDFViewer')}
      >
        Open PDF 1
      </Button>
      <br />
      <Button
        variant="contained"
        onClick={() => window.open('https://github.com', 'PDFViewer')}
      >
        Open PDF 2
      </Button>
    </Stack>
  )
}
