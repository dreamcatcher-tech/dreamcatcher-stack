import bytes from 'pretty-bytes'
import Stack from '@mui/material/Stack'
import DialogTitle from '@mui/material/DialogTitle'
import DialogActions from '@mui/material/DialogActions'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import OpenInNew from '@mui/icons-material/OpenInNew'
import Download from '@mui/icons-material/Download'
import Button from '@mui/material/Button'
import React, { useEffect } from 'react'
import Debug from 'debug'
import PropTypes from 'prop-types'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

const debug = Debug('webdos:components:PdfModal')
const PdfModal = ({ runDate, open = false, onPdf, onClose, generator }) => {
  const [url, setUrl] = React.useState()
  const close = () => {
    if (url && !onPdf) {
      debug('revoking url', url)
      URL.revokeObjectURL(url)
      setUrl()
    }
    onClose()
  }
  const title = `PDF Manifest for ${runDate}`
  const [status, setStatus] = React.useState()
  const [pagesDone, setPagesDone] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(0)
  const [size, setSize] = React.useState(0)
  useEffect(() => {
    if (!open) {
      return
    }
    let isActive = true
    const generate = async () => {
      debug('generate')
      setStatus('preparing')
      await generator.prepare()
      setStatus('generating')
      for await (const total of generator) {
        if (!isActive) {
          debug('cancelled')
          return
        }
        setTotalPages(total)
        setPagesDone((pagesDone) => pagesDone + 1)
      }
      debug('saving')
      setStatus('saving')
      const { url, size } = await generator.save()
      if (!isActive) {
        debug('cancelled')
        return
      }
      setUrl(url)
      setSize(size)
      setStatus('done')
    }
    generate()
    return () => {
      debug('unmount')
      isActive = false
      setStatus()
      setPagesDone(0)
      setTotalPages(0)
      setSize(0)
    }
  }, [generator, open])
  const Progress = () => {
    if (status === 'preparing') {
      const message = 'Preparing...'
      return <LinearProgressWithLabel unknown message={message} />
    }
    if (status === 'generating') {
      const total = totalPages || 1
      const value = (pagesDone / total) * 100
      const message = `Generating... ${pagesDone} of ${totalPages} pages`
      return <LinearProgressWithLabel {...{ value, message }} />
    }
    if (status === 'saving') {
      const message = `Saving ${totalPages} pages...`
      return <LinearProgressWithLabel value={100} message={message} unknown />
    }
    if (status === 'done') {
      const message = `Saved ${totalPages} pages in ${bytes(size)}`
      return <LinearProgressWithLabel value={100} message={message} />
    }
    return null
  }
  const filename = generator.title + '.pdf'
  return (
    <Dialog onClose={close} open={open} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Progress />
      </DialogContent>
      <DialogActions disableSpacing>
        <Stack direction="row" spacing={2}>
          <Button
            disabled={!url}
            variant="contained"
            href={url}
            target="PDFManifestViewer"
          >
            Open&nbsp; <OpenInNew />
          </Button>
          <Button
            disabled={!url}
            variant="contained"
            href={url}
            download={filename}
          >
            Download&nbsp; <Download />
          </Button>
          <Button onClick={close}>Cancel</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
PdfModal.propTypes = {
  runDate: PropTypes.string.isRequired,
  /**
   * If true, the dialog is open.
   */
  open: PropTypes.bool,
  /**
   * Callback with the generated pdf url.
   * This signals that no cleanup of the blob url is required.
   */
  onPdf: PropTypes.func,
  onClose: PropTypes.func,
  /**
   * async iterator that returns value of shape: { count, total}
   * then has function save() that returns a blob url
   */
  generator: PropTypes.object,
}
export default PdfModal

function LinearProgressWithLabel(props) {
  const { value, message, unknown } = props
  const variant = unknown ? 'indeterminate' : 'determinate'
  const percentage = unknown ? '--%' : `${Math.round(value)}%`
  return (
    <Stack>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: '100%', mr: 1, justifyContent: 'center' }}>
          <Typography>{message}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress value={value} variant={variant} />
        </Box>
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">
            {percentage}
          </Typography>
        </Box>
      </Box>
    </Stack>
  )
}

LinearProgressWithLabel.propTypes = {
  /**
   * The value of the progress indicator for the determinate and buffer variants.
   * Value between 0 and 100.
   */
  value: PropTypes.number,
  message: PropTypes.string.isRequired,
  unknown: PropTypes.bool,
  status: PropTypes.string,
}
