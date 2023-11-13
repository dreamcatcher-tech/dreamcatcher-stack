import Box from '@mui/system/Box'
import Grid from '@mui/material/Unstable_Grid2'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import Send from '@mui/icons-material/Send'
import Input from '@mui/material/Input'
import InputLabel from '@mui/material/InputLabel'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import TextField from '@mui/material/TextField'
import AccountCircle from '@mui/icons-material/AccountCircle'
import ArrowUpwardIconValid from '@mui/icons-material/ArrowUpwardTwoTone'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardRounded'

const debug = Debug('AI:ThreeBox')
debug(`loaded`)

const ThreeBox = ({ crisp }) => {
  if (!crisp || crisp.isLoading) {
    return
  }
  return (
    <Grid
      container
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'red',
      }}
    >
      <Grid xs="auto" sx={{ backgroundColor: 'blue', height: '100%' }}>
        <Stack
          direction="column"
          alignItems="flex-start"
          justifyContent="flex-end"
          sx={{ backgroundColor: 'orange', height: '100%' }}
        >
          <TextField
            multiline
            placeholder="Message DreamcatcherGPT..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AccountCircle />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <ArrowUpwardIcon sx={{ backgroundColor: 'gray' }} />
                </InputAdornment>
              ),
            }}
            variant="standard"
          />
        </Stack>
      </Grid>
      <Grid xs="2" sx={{ backgroundColor: 'green', height: '100%' }}>
        asdf
      </Grid>
      {/* <Box sx={{ zIndex: 1 }}>
          <Nav crisp={crisp} />
        </Box>
        {isLoading(crisp) ? (
          <div>Loading...</div>
        ) : (
          <>
            <Glass.Lazy show={wd.startsWith('/schedules')}>
              <Schedules
                crisp={schedules}
                customers={customers}
                routing={routing}
              />
            </Glass.Lazy>
            <Glass.Lazy show={wd.startsWith('/customers')}>
              <CollectionList crisp={customers} />
            </Glass.Lazy>
            <Glass.Lazy show={wd.startsWith('/routing')}>
              <Routing crisp={routing} customers={customers} />
            </Glass.Lazy>
          </>
        )} */}
    </Grid>
  )
}
ThreeBox.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default ThreeBox
