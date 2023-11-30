# HAL Stories

This is a list of stories that describe the functionality that we need from HAL when operating the CRM.

The stories described in here will be attempted to be executed using a simulation of the user, and will appraise the results.

In the running system, this document will be used by the guardian to determine if what Dave has asked for is outside the tested capabilities of HAL.
This is important, since this boundary defines what a Stuck is.

The test runner needs to be an intelligence, and it needs to break apart the story into: prepare, act, assert.

## Adding a new customer

HAL will be asked to add a new customer, and will require Dave to give at the very least the name of the customer to add.
assertions:

1. HAL should not ask for any fields other than the required fields of the customer
1. There should be a single new customers
1. That customer should have only the name field set

## List all customers

When asked for all the customers, the paginated list should show up on the stateboard.  Drilling down into each item should reveal what that item was.
