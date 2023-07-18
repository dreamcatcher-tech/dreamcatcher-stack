import './App.css'
import { Glass, Nav, Crisp, CollectionList } from '@dreamcatcher-tech/webdos'
import { Container } from '@mui/material'
import PropTypes from 'prop-types'

function App({ crisp }) {
  const { wd } = crisp
  console.log(crisp)
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
      <Glass.Lazy show={wd.startsWith('/packets')}>
        <CollectionList crisp={crisp.tryGetChild('packets')} />
      </Glass.Lazy>
      <Glass.Lazy show={wd.startsWith('/drafts')}>
        <CollectionList crisp={crisp.tryGetChild('drafts')} />
      </Glass.Lazy>
      <Glass.Lazy show={wd.startsWith('/qa')}>
        <CollectionList crisp={crisp.tryGetChild('qa')} />
      </Glass.Lazy>
    </Container>
  )
}
App.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default App
