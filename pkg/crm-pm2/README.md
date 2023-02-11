# crm-pm2

When run, will:
1. Store its blocks on disk
2. Begin listening on the given address 
3. Load up SSL certs from a `.env` file
4. publish its multiaddresses to console
5. install bar bones version of the CRM.
6. populate the sector data
7. optionally generate fake customer data and progressively insert it

To deploy this onsite:
1. install [pm2](https://www.npmjs.com/package/pm2)
1. If on windows, use [pm2 installer](https://github.com/jessety/pm2-installer)
1. Set SSL keys in a config file
1. `pm2 install @dreamcatcher-tech/crm-pm2` to pull down the latest version from npm and run it

## Server options
`--faker 123` Generate fake data, using the given number of customers

`--port 1234` Listen on the given port number, or use a default random one

`--admin rootChainId` Supply a chainId to allow to connect without being authd

`repo` required as this is installed globally, so must say where the repo will be.  KV store is in `repo/interpulse/`.

`.env` provided as a file which holds SSL keys.  If a .env file is found at the same place as the repo, it will be loaded ie: `repo/.env` will be loaded.

## Upgrade process
1. Halt pm2
2. zip up a copy of the db files for backup
3. probably `pm2 install @dreamcatcher-tech/crm-pm2` to upgrade the installed package
5. Connect using dev version of the webapp for testing
6. publish the webapp if passes testing
