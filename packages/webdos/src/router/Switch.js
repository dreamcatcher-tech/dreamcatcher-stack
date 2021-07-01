/**
 * ? do we need our own lib, or can we use react-router directly ?
 * possibly fork it, so we use some of its base components, and override some ?
 *
 * Must repond to route changes, but also look at covenants to choose component.
 * Must render for the full path, and for each one, we look to the covenants.
 * Allow overloads of some paths.
 * ? select a component based on a covenant match
 *
 * Renders everything along the path, which allows some children to overdraw parents
 * Deeply nested paths, which child switches.
 * ? Could do relativePath and path to specify when nested ?
 * or any nested component represents a nested path, and so match must be prefixed
 * with the parents path for the match to trigger
 *
 * We need model of multiple matches.
 * If Datums could be linked to templates, then we could render base on that ?
 * Allow a default where we make a selection based on covenant type ?
 * Some ui is specified by the uiSchema field, so we can select standard components ?
 *
 * exact: path must fully match, exactly
 *
 * Render placeholders while children may still be pulling in data.
 */

import CustomerList from '../components/CustomerList'
const mock = (
  <Switch>
    <Route covenant="crm">
      <Home />
      <Route path="/schedules/" exact>
        <Schedules />
      </Route>
      <Route path="/customers">
        {' '}
        // should be detected by covenant
        <CustomerList />
        <Route path="/:customer">
          <Customer />
        </Route>
      </Route>
      <Route path="**/customerId-*">
        <Customer />
      </Route>
      <Route datum="Customer">
        <Customer />
      </Route>
      <Route covenant="customCovenant"></Route>
    </Route>
  </Switch>
)

const Switch = (path) => {}

const Link = (path) => {
  // equivalent of doing a cd(path) when clicked on
}

export default Switch
