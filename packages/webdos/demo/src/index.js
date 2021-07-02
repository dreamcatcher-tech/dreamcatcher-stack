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
} from '../../src'
import Debug from 'debug'
import { crm } from './crm'
import cov from './covenant'
import multi from './multi'

Debug.enable('covenant* *Blockchain *shell* *:Nav *Terminal')
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
 */

export default class Demo extends Component {
  render() {
    return (
      <div>
        <h2>Demo</h2>
        <Blockchain dev={multi}>
          <Terminal path="/" style={{ height: '40vh' }} />
          {/*
          <Router>
            <Switch>
              <Route covenant="crm">
                <Nav />
                <Route path="/schedules/" exact>
                  <div>Schedules ?</div>
                </Route>
                <Route path="/customers">
                  // should be detected by covenant
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
