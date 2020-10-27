describe('causes', () => {
  test('non system promise rejects', () => {
    // make a reducer that returns a simple promise to wait for a time then resolve
    // verify that @@io queue showed it exiting correctly
  })
  test('system promise', () => {
    // reducer with system promise being invoked
  })
  test.todo('system promise rejection after timeout')
  test.todo('mixture of promise types in the same reducer')
  test.todo('state change causes branching to leave dangling promise ?')
  test.todo('reducer is paused from other actions until promise resolves ?')
  test.todo('concurrent promises')
  test.todo('request to another chain')
})
