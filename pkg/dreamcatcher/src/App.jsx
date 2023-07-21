import { useCallback, useState, useMemo } from 'react'
import { Nav, Crisp } from '@dreamcatcher-tech/webdos'
import List from './stories/List'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'
import TabContext from '@mui/lab/TabContext'
import TabPanel from '@mui/lab/TabPanel'
import { Packets } from './stories/Packets'
import { Drafts } from './stories/Drafts'
import { Changes } from './stories/Changes'

// relative position so the fab positions correctly

function App({ crisp }) {
  const { wd } = crisp
  const [isCreating, setIsCreating] = useState(false)
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
  let onCreate = useCallback(() => {
    const drafts = crisp.tryGetChild('drafts')
    if (!drafts || drafts.isLoadingActions) {
      return
    }
    setIsCreating(true)
    drafts.actions
      .createDraftHeader(Date.now())
      .then(({ alias }) => crisp.actions.cd(crisp.absPathTo(`drafts/${alias}`)))
      .finally(() => setIsCreating(false))
  }, [crisp])
  const isCreateable =
    !crisp.isLoadingChildren &&
    crisp.hasChild('drafts') &&
    !crisp.getChild('drafts').isLoadingActions
  onCreate = isCreating || !isCreateable ? undefined : onCreate

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Nav crisp={crisp} />
      <TabContext value={index}>
        <TabPanel value="packets" sx={{ flexGrow: 1, padding: 0 }}>
          <Packets crisp={crisp.tryGetChild('packets')} onCreate={onCreate} />
        </TabPanel>
        <TabPanel value="drafts" sx={{ flexGrow: 1, padding: 0 }}>
          <Drafts crisp={crisp.tryGetChild('drafts')} onCreate={onCreate} />
        </TabPanel>
        <TabPanel value="changes" sx={{ flexGrow: 1, padding: 0 }}>
          <Changes crisp={crisp.tryGetChild('changes')} onCreate={onCreate} />
        </TabPanel>
      </TabContext>
    </Box>
  )
}
App.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default App
