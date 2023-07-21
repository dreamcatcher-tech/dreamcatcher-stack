import PropTypes from 'prop-types'
import * as React from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import Dialog from '@mui/material/Dialog'
import Chip from '@mui/material/Chip'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import Slide from '@mui/material/Slide'
import Fab from './Fab'
import { Paper, Stack } from '@mui/material'
import Avatar from '@mui/material/Avatar'

const ETH =
  'https://cryptologos.cc/logos/versions/ethereum-eth-logo-colored.svg?v=025'
const DAI =
  'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg?v=025'
const SILD = 'https://i.seadn.io/gcs/files/594ccb2cd1af2f30a00901123d05adc7.png'
const HNT = 'https://cryptologos.cc/logos/helium-hnt-logo.svg?v=025'

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />
})

export default function Packet({ crisp }) {
  const handleClose = () => {
    crisp?.actions?.cd('..')
  }

  const { formData = {} } = crisp?.state || {}
  let {
    name,
    description,
    image,
    time,
    details,
    funds,
    downstreamIds = [],
  } = formData
  time = time && new Date(time).toISOString()
  funds = funds && funds.toLocaleString()

  return (
    <Dialog
      fullScreen
      open={!!crisp}
      onClose={handleClose}
      TransitionComponent={Transition}
    >
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Packet: {crisp?.name}
          </Typography>
          <Fab type="fund" disabled={crisp?.isLoadingActions} />
        </Toolbar>
      </AppBar>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Typography variant="h5" sx={{ p: 2 }}>
          {name}
        </Typography>
        <Paper sx={{ p: 2, m: 2, textAlign: 'center' }}>
          <img src={image} width={512} />
          <Typography>
            created: <b>{time}</b>
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, m: 2 }}>
          <Typography variant="h6">Summary</Typography>
          <Typography variant="body1">{description}</Typography>
        </Paper>
        <Paper sx={{ p: 2, m: 2 }}>
          <Stack direction="row" spacing={1}>
            <Typography variant="h6">Funding</Typography>

            <Chip avatar={<Avatar src={DAI} />} label={`DAI: $${funds || 0}`} />
            <Chip avatar={<Avatar src={ETH} />} label={`ETH: ${funds || 0}`} />
            <Chip
              avatar={<Avatar src={SILD} />}
              label={`West Coast NFTs: ${funds || 0}`}
            />
            <Chip avatar={<Avatar src={HNT} />} label={`HNT: ${funds || 0}`} />
          </Stack>
        </Paper>
        <Paper sx={{ p: 2, m: 2 }}>
          <Typography variant="h6">
            Solutions ({downstreamIds.length})
          </Typography>
        </Paper>
        {details && (
          <Paper sx={{ p: 2, m: 2 }}>
            <Typography variant="h6">Details</Typography>
            <Typography variant="body1">{description}</Typography>
          </Paper>
        )}
      </Stack>
    </Dialog>
  )
}
Packet.propTypes = { crisp: PropTypes.instanceOf(Crisp) }
