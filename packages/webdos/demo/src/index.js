import { version } from '../../package.json'
import './demo.css'
import React, { Component } from 'react'
import { render } from 'react-dom'
import { Blockchain, Terminal, Router, Switch, Route } from '../../src'
import {
  About,
  Account,
  Customer,
  CustomerList,
  Datum,
  Explorer,
  Nav,
  OpenDialog,
  Settings,
  MapBackground,
  AppContainer,
  Services,
} from '../../src'
import Debug from 'debug'
import { crm } from './crm'
import cov from './covenant'
import multi from './multi'
Debug.enable('*:widgets:* *Route ')
/**
 * Have to be able to install without publishing.
 * Must install if the app not already installed. ? ensureInstall() ?
 * In dev, must be able to set up a full system, and load fake data.
 *
 * Hot patch already published code, so we override the execution ?
 *
 * Route specifies a priority based switch between route matches
 * If all of path not fully matched, keeps going down the switch statement.
 * Idea is that overrides and custom items come first, then default fallbacks.
 *
 * Want the default to just be displayed based on the app.
 * Switch can be repeatable for each piece of the path.
 *    Can be depth first, where each case is checked for each path segment
 *    Breadth first walks the whole path for each case before going to the next one
 * Want consumption of parts of a path, then anything not consumed falls thru below.
 * state matcher
 */
const Map = () => {
  return (
    <MapBackground>
      <h1>child drawn on top of map</h1>
    </MapBackground>
  )
}

export default class Demo extends Component {
  render() {
    return (
      <div className="flex-box">
        <h4>Demo version: {version}</h4>
        <Blockchain dev={multi}>
          <Terminal path="/" className="flex-term" />
          <Router>
            <Switch>
              <Route covenant="multi">
                <AppContainer>
                  <Nav />
                  <MapBackground>
                    <Switch>
                      <Route path="/customers" component={<CustomerList />} />
                      <Route path="/services" component={<Services />} />
                    </Switch>
                  </MapBackground>
                  <Route path="/custNo-*" component={<Customer />} />
                </AppContainer>
              </Route>
              <Route component={<Explorer />} />
            </Switch>
          </Router>
          {/*
          <Router>
            <Switch>
              <Route covenant="crm" component={<Nav />}>
                <Route path="/schedules/" exact>
                  <div>Schedules ?</div>
                </Route>
                <Route path="/customers">
                  // should be auto detected based on covenant
                  <CustomerList />
                  <Route path="/:customer">
                    <Customer />
                  </Route>
                </Route>
                <Route path="*d *d /customerId-*">
                  <Customer />
                </Route>
                <Route datum="Customer">
                  <Customer />
                </Route>
                <Route covenant="customCovenant"></Route>
                <Route path="/">
                  // render a blockexplorer component for everything else
                </Route>
                <Route auto>
                  display nested covenants using default display items for known
                  covenants
                </Route>
              </Route>
            </Switch>
          </Router> */}
        </Blockchain>
      </div>
    )
  }
}

render(<Demo />, document.querySelector('#demo'))
