# raspar  

data scraping tasks.  

## Install  

`yarn install`  

The script can now be run as `node raspar-cli.js <cmd> [options]`.  

## Generating stand-alone binaries  

Be sure you have `pkg` installed globally: `sudo npm install -g pkg`.  

Run the package script in the current path: `yarn run pkg`  

Copy the generated binary to you local bin path:  

`sudo cp dist/raspar-linux /usr/local/bin/raspar && sudo chmod a+rx /usr/local/bin/raspar`  

Now you can just use the command `raspar`  

## Run  

To view all available commands and their syntax use:  

`raspar --help`  

To view help for a single command, use:  

`raspar noaa-buoy --help` 

where `noaa-buoy` is the name of the command you want help for.  