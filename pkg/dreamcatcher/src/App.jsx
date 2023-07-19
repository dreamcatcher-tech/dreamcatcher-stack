import './App.css'
import React, { useState, useMemo } from 'react'
import { Nav, Crisp } from '@dreamcatcher-tech/webdos'
import List from './stories/List'
import { Container } from '@mui/material'
import PropTypes from 'prop-types'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import Fab from '@mui/material/Fab'
import CreateIcon from '@mui/icons-material/Create'
import MintIcon from '@mui/icons-material/AutoFixHigh'
import FundIcon from '@mui/icons-material/SwitchAccessShortcut'
import DisputeIcon from '@mui/icons-material/LocalFireDepartment'
import SolveIcon from '@mui/icons-material/TipsAndUpdates'
import { green, purple, amber, red, lightGreen } from '@mui/material/colors'

// relative position so the fab positions correctly
const sxTabPanel = { flexGrow: 1, padding: 0 }
const fabCreateStyle = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  mr: 3,
  color: 'common.white',
  bgcolor: green[500],
  '&:hover': {
    bgcolor: green[600],
  },
  width: 130,
}
const fabMintStyle = {
  ...fabCreateStyle,
  bgcolor: purple[500],
  '&:hover': {
    bgcolor: purple[600],
  },
}
const fabFundStyle = {
  ...fabCreateStyle,
  color: 'common.black',
  bgcolor: amber[500],
  '&:hover': {
    bgcolor: amber[600],
  },
}
const fabDisputeStyle = {
  ...fabCreateStyle,
  color: 'common.black',
  bgcolor: red[500],
  '&:hover': {
    bgcolor: red[600],
  },
}
const fabSolveStyle = {
  ...fabCreateStyle,
  bgcolor: green[500],
  '&:hover': {
    bgcolor: green[600],
  },
}
const columns = [
  {
    width: 80,
    disableColumnMenu: true,
    hideable: false,
    sortable: false,
    resizable: false,
  },
  { flex: 1 },
  {},
  {
    width: 150,
    type: 'dateTime',
    valueFormatter: (params) => {
      if (typeof params.value !== 'number') {
        return
      }
      return new Date(params.value).toDateString()
    },
  },
]
function App({ crisp }) {
  const { wd } = crisp
  console.log(crisp)
  const [index, setIndex] = useState('')
  useMemo(() => {
    if (wd.startsWith('/packets')) {
      setIndex('packets')
    } else if (wd.startsWith('/drafts')) {
      setIndex('drafts')
    } else if (wd.startsWith('/changes')) {
      setIndex('changes')
    }
  }, [wd])

  return (
    <Container
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Nav crisp={crisp} />
      <TabContext value={index}>
        <TabPanel value="packets" sx={sxTabPanel}>
          <List crisp={crisp.tryGetChild('packets')} columns={columns} />
          <Fab variant="extended" sx={fabCreateStyle}>
            <CreateIcon sx={{ mr: 1 }} />
            Create
          </Fab>
        </TabPanel>
        <TabPanel value="drafts" sx={sxTabPanel}>
          <List crisp={crisp.tryGetChild('drafts')} />
        </TabPanel>
        <TabPanel value="changes" sx={sxTabPanel}>
          <List crisp={crisp.tryGetChild('changes')} />
        </TabPanel>
      </TabContext>
      {/* <Fab variant="extended" sx={fabMintStyle} >
        <MintIcon sx={{ mr: 1 }} />
        Mint
      </Fab> */}
      {/* <Fab variant="extended" sx={fabFundStyle}>
        <FundIcon sx={{ mr: 1 }} />
        Fund
      </Fab> */}
      {/* <Fab variant="extended" sx={fabDisputeStyle}>
        <DisputeIcon sx={{ mr: 1 }} />
        Dispute
      </Fab> */}
      {/* <Fab variant="extended" sx={fabSolveStyle}>
        <SolveIcon sx={{ mr: 1 }} />
        Solve
      </Fab> */}
    </Container>
  )
}
App.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default App
