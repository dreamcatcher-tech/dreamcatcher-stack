import './App.css'
import React, { useState, useMemo } from 'react'
import { Glass, Nav, Crisp, CollectionList } from '@dreamcatcher-tech/webdos'
import { Container } from '@mui/material'
import PropTypes from 'prop-types'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import Fab from '@mui/material/Fab'
import CreateIcon from '@mui/icons-material/AutoFixHigh'
import { green } from '@mui/material/colors'

// relative position so the fab positions correctly
const sxTabPanel = { flexGrow: 1, padding: 0, position: 'relative' }
const fabStyle = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  color: 'common.white',
  bgcolor: green[500],
  '&:hover': {
    bgcolor: green[600],
  },
}
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
      }}
    >
      <Nav crisp={crisp} />
      <TabContext value={index}>
        <TabPanel value="packets" sx={sxTabPanel}>
          <CollectionList crisp={crisp.tryGetChild('packets')}></CollectionList>
          <Fab variant="extended" sx={fabStyle} color="green">
            <CreateIcon sx={{ mr: 1 }} />
            Create
          </Fab>
        </TabPanel>
        <TabPanel value="drafts" sx={sxTabPanel}>
          <CollectionList crisp={crisp.tryGetChild('drafts')} />
        </TabPanel>
        <TabPanel value="changes" sx={sxTabPanel}>
          <CollectionList crisp={crisp.tryGetChild('changes')} />
        </TabPanel>
      </TabContext>
    </Container>
  )
}
App.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default App
