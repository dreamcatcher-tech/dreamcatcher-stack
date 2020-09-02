## Deployment

The serverless.com components in use here are split between beta version and GA version.
w201 & w202 are new version, which were chosen to attempt to stay on the serverless main line of development, and also to use the layer feature for lambda, to reduce the function build size down from 3MB to 307KiB. This is much more manageable over TOR.

w201 and w202 pull their credentials from ../.env but w204 only seems to be able to use w204/.env

The system cannot deploy everything at once, and instead needs 3 deploy steps, in order. But after this,

Sls version info:

```
Framework Core: 1.80.0
Plugin: 3.8.0
SDK: 2.3.1
Components: 2.34.8
```

### w201-lambda-layer

1. ensure all base dependencies are in package.json
2. run `yarn` to install those dependencies
3. deploy the component `sls --debug`

### w202-lambda-stream-processor

1. deploy the component `sls --debug` which creates two roles:
   a. meta: reads cloudwatch logs and annoying streams them back to serverless.com
   b. lambda: used for actual execution of the lambda function
2. copy the arn into w204-lambda-deployment in .env file using key `LAMBDA-STREAM-PROCESSOR`
3. take the role name, and set this in the key `roleName` so role permissions persist between updates

### w204-lambda-deployment

1. If the api gateway is being redeployed, w202 must be redeployed too, so the invoke permission is overwritten https://github.com/serverless-components/aws-websockets/issues/4
1. attach the policy `AmazonAPIGatewayInvokeFullAccess` to the lambda execution role, to allow lambda to push to websocket clients
1. deploy the component `sls --debug`
1. set up a trigger from sqsSafety to the lambda function
1. replace references to `terminalChainId` with the newly created terminal chainId
