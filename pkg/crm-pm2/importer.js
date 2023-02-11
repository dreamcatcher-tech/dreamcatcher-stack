/**
 * Plan is to use pm2 to trigger moneyworks import and send back logs of the progress.
 */

//   /**
//    *                Simple Actions
//    *
//    *   Now let's expose some triggerable functions
//    *  Once created you can trigger this from Keymetrics
//    *
//    */
//   pmx.action('env', function (reply) {
//     return reply({
//       env: 'some env vars',
//     })
//   })

//   /**
//    *                 Scoped Actions
//    *
//    *     This are for long running remote function
//    * This allow also to res.emit logs to see the progress
//    *
//    **/
//   // var spawn = require('child_process').spawn

//   pmx.scopedAction('lsof cmd', function (options, res) {
//     var child = spawn('lsof', [])

//     child.stdout.on('data', function (chunk) {
//       chunk
//         .toString()
//         .split('\n')
//         .forEach(function (line) {
//           /**
//            * Here we send logs attached to this command
//            */
//           res.send(line)
//         })
//     })

//     child.stdout.on('end', function (chunk) {
//       /**
//        * Then we emit end to finalize the function
//        */
//       res.end('end')
//     })
//   })
// }
