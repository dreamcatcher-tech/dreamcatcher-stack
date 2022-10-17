import React, { Component } from 'react'
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
import multi from './multi'
import timesheets from './timesheets'
import Debug from 'debug'
const debug = Debug('client:tests:App')
Debug.enable('webdos:hooks:usePath* iplog *Mapping ')

export default class Demo extends Component {
  render() {
    return (
      <Blockchain dev={multi}>
        <Terminal style={{ height: '30vh', background: 'black' }} />
        <Router>
          <Switch>
            <Route covenant="crm">
              <AppContainer>
                <Nav />
                <MapBackground>
                  {/* <Switch>
                    <Route path="/customers">
                      <CollectionList />
                    </Route>
                    <Route path="/services" component={<Geometry />} />
                  </Switch> */}
                </MapBackground>
                <Route path="/custNo-*" component={<DialogDatum />} />
              </AppContainer>
            </Route>
            <Route component={<Explorer />} />
          </Switch>
        </Router>
      </Blockchain>
    )
  }
}
