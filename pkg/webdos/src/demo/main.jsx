import { version } from '../../package.json'
import './demo.css'

import React, { useEffect, Component } from 'react'
import ReactDOM from 'react-dom'
import { Blockchain, Terminal, Router, Switch, Route } from '..'

import {
  About,
  Account,
  DialogDatum,
  CollectionList,
  Datum,
  Explorer,
  Nav,
  OpenDialog,
  Settings,
  MapBackground,
  AppContainer,
  Geometry,
} from '..'
import { crm } from './crm'
import cov from './covenant'
import multi from './multi'
import timesheets from './timesheets'
import Debug from 'debug'
const debug = Debug('client:tests:App')
Debug.enable('*:widgets:* *Route *Switch *met* ')

const Map = () => {
  return (
    <MapBackground>
      <h1>child drawn on top of map</h1>
    </MapBackground>
  )
}

const Timesheets = () => {
  return (
    <div style={{ display: 'flex', flexFlow: 'column', flex: 1 }}>
      <h4>Demo version: {version}</h4>
      <Blockchain dev={multi}>
        <Terminal style={{ height: '280px', background: 'black' }} />
        <Router>
          <Switch>
            <Route covenant="multi">
              <AppContainer>
                <Nav />
                <MapBackground>
                  <Switch>
                    <Route path="/timesheets" component={<CollectionList />}>
                      <Route path="/custNo-*" component={<DialogDatum />} />
                    </Route>
                    <Route path="/personnel" component={<CollectionList />}>
                      <Route path="/custNo-*" component={<DialogDatum />} />
                    </Route>
                    <Route path="/sites" component={<Geometry />} />
                    <Route path="/payments" component={<CollectionList />}>
                      <Route path="/payNo-*" component={<DialogDatum />} />
                    </Route>
                    <Route path="/about" component={<About />} />
                    <Route path="/settings" component={<Settings />} />
                    <Route path="/account" component={<Account />} />
                  </Switch>
                </MapBackground>
              </AppContainer>
            </Route>
            <Route component={<Explorer />} />
          </Switch>
        </Router>
      </Blockchain>
    </div>
  )
}
export default class Demo extends Component {
  render() {
    return (
      <div style={{ display: 'flex', flexFlow: 'column', flex: 1 }}>
        <h4>Demo version: {version}</h4>
        <Blockchain dev={multi}>
          <Terminal style={{ height: '280px', background: 'black' }} />
          <Router>
            <Switch>
              <Route covenant="multi">
                <AppContainer>
                  <Nav />
                  <MapBackground>
                    <Switch>
                      <Route path="/customers" component={<CollectionList />} />
                      <Route path="/services" component={<Geometry />} />
                    </Switch>
                  </MapBackground>
                  <Route path="/custNo-*" component={<DialogDatum />} />
                </AppContainer>
              </Route>
              <Route component={<Explorer />} />
            </Switch>
          </Router>
        </Blockchain>
      </div>
    )
  }
}

ReactDOM.render(<Demo />, document.querySelector('#root'))
