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
  Map,
  AppContainer,
  Geometry,
} from '..'
import multi from './multi'
import timesheets from './timesheets'
import Debug from 'debug'
const debug = Debug('client:tests:App')
Debug.enable(' iplog *Datum*  *CollectionList')

/**
 * This is an inbrowser blockchain with the crm loaded in it
 * for demonstration purposes
 */
export default class Demo extends Component {
  render() {
    return (
      <Blockchain dev={multi}>
        <Terminal style={{ height: '100vh', background: 'black' }} />
        {/* <Router>
          <Switch>
            <Route covenant="crm">
              <AppContainer>
                <Nav />
                <Map>
                  <Switch>
                    <Route path="/customers">
                      <CollectionList />
                    </Route>
                    <Route path="/services">
                      <Geometry />
                    </Route>
                    <Route path="/about">
                      <About />
                    </Route>
                    <Route path="/settings">
                      <Settings />
                    </Route>
                  </Switch>
                  <Route path="/account">
                    <Account />
                  </Route>
                </Map>
                <Route path="/custNo-*">
                  <DialogDatum />
                </Route>
              </AppContainer>
            </Route>
            <Route component={<Explorer />} />
          </Switch>
        </Router> */}
      </Blockchain>
    )
  }
}
