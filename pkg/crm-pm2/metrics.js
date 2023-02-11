/**
 * Plan is to send back chain statistics, like total size, connections, data sent, etc.
 */

//   /**
//    *                      Custom Metrics
//    *
//    * Let's expose some metrics that will be displayed into Keymetrics
//    *   For more documentation about metrics: http://bit.ly/1PZrMFB
//    */
//   var Probe = pmx.probe()

//   var value_to_inspect = 0

//   /**
//    * .metric, .counter, .meter, .histogram are also available (cf doc)
//    */
//   var val = Probe.metric({
//     name: 'test-probe',
//     value: function () {
//       return value_to_inspect
//     },
//     /**
//      * Here we set a default value threshold, to receive a notification
//      * These options can be overriden via Keymetrics or via pm2
//      * More: http://bit.ly/1O02aap
//      */
//     alert: {
//       mode: 'threshold',
//       value: 20,
//       msg: 'test-probe alert!',
//       action: function (val) {
//         // Besides the automatic alert sent via Keymetrics
//         // You can also configure your own logic to do something
//         console.log('Value has reached %d', val)
//         debug('test probe triggered')
//       },
//     },
//   })

//   setInterval(function () {
//     // Then we can see that this value increase over the time in Keymetrics
//     value_to_inspect++
//   }, 300)
