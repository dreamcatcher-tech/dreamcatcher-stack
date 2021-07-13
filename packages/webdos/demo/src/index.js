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
import timesheets from './timesheets'
Debug.enable('*:widgets:* *Route ')
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
      <Blockchain dev={timesheets}>
        <Terminal style={{ height: '280px', background: 'black' }} />
        <Router>
          <Switch>
            <Route covenant="timesheets">
              <AppContainer>
                <Nav />
                <MapBackground>
                  <Switch>
                    <Route path="/timesheets" component={<CustomerList />} />
                    <Route path="/personnel" component={<CustomerList />} />
                    <Route path="/sites" component={<Services />} />
                    <Route path="/payments" component={<CustomerList />} />
                  </Switch>
                </MapBackground>
                <Route path="/custNo-*" component={<Customer />} />
                <Route path="/payNo-*" component={<Customer />} />
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

render(<Timesheets />, document.querySelector('#demo'))
