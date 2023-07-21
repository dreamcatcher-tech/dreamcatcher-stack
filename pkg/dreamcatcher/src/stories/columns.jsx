import { Chip } from '@mui/material'
import AcceptedIcon from '@mui/icons-material/ThumbUp'
import RejectedIcon from '@mui/icons-material/ThumbDown'
import JudgingIcon from '@mui/icons-material/Gavel'
import MintIcon from '@mui/icons-material/AutoFixHigh'
import EditIcon from '@mui/icons-material/Edit'
import DisputeIcon from '@mui/icons-material/LocalFireDepartment'
import SolveIcon from '@mui/icons-material/TipsAndUpdates'

const image = {
  width: 60,
  disableColumnMenu: true,
  hideable: false,
  sortable: false,
  resizable: false,
  align: 'center',
  renderCell: (params) => <img src={params.value} height={45} />,
}
const title = {
  flex: 1,
  maxWidth: 450,
  valueFormatter: (params) => {
    if (!params.value) {
      return `(No Title)`
    }
    return params.value
  },
}
const description = { flex: 1 }
const funds = {}
const time = {
  width: 150,
  type: 'dateTime',
  valueFormatter: (params) => {
    if (typeof params.value !== 'number') {
      return
    }
    return new Date(params.value).toDateString()
  },
}

const type = {
  ...image,
  width: 120,
  renderCell: (params) => {
    let color = 'default'
    let icon
    let label = params.value
    // ['solution', 'header', 'dispute', 'edit'],
    switch (params.value) {
      case 'solution':
        color = 'success'
        icon = <SolveIcon />
        break
      case 'header':
        color = 'secondary'
        icon = <MintIcon />
        break
      case 'dispute':
        color = 'error'
        icon = <DisputeIcon />
        break
      case 'edit':
        color = 'primary'
        icon = <EditIcon />
        break
    }

    return (
      <Chip
        label={label}
        color={color}
        icon={icon}
        sx={{ width: 100, alignContent: 'left' }}
        variant="outlined"
      />
    )
  },
}

const status = {
  ...image,
  width: 130,
  renderCell: (params) => {
    let color = 'default'
    let icon
    let label = params.value
    // [
    //   'pending',
    //   'judging',
    //   'disputable',
    //   'accepted',
    //   'rejected',
    //   'disputed',
    // ]
    switch (params.value) {
      case 'pending':
        color = 'default'
        icon = <EditIcon />
        break
      case 'judging':
        color = 'warning'
        icon = <JudgingIcon />
        break
      case 'disputable':
        color = 'info'
        icon = <DisputeIcon />
        break
      case 'accepted':
        color = 'success'
        icon = <AcceptedIcon />
        break
      case 'rejected':
        color = 'error'
        icon = <RejectedIcon />
        break
      case 'disputed':
        color = 'error'
        icon = <DisputeIcon />
        break
    }

    return (
      <Chip
        label={label}
        color={color}
        deleteIcon={icon}
        onDelete={() => {}}
        sx={{ width: 110, alignContent: 'left' }}
        variant="outlined"
      />
    )
  },
}
export const packets = [image, title, description, funds, time]

export const drafts = [type, image, title, description, time]

export const changes = [type, status, image, title, description, funds, time]
