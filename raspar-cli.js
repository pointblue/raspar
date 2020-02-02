#!/usr/bin/env node

let raspar = require('./index');
let fs = require('fs');

//configure the command line
let _argv = require('yargs').scriptName("raspar")
    .usage('$0 <cmd> [args]')
    .command('noaa-buoy [station_id]', 'get noaa buoy station data formatted as csv', function(yargs){
        yargs.positional('station_id', {
            type: 'string',
            describe: 'The ID of the buoy station you want data for, multiple ID values separated by comma, or a ' +
                'file name containing a station id per line.'
        })
            .demandOption('station_id')
            .option('date-filter', {
                requiresArg: true,
                describe: 'a year',
                type: 'string'
            })
            .example('$0 noaa-buoy PORO3', 'get data from station id PORO3')
            .example('$0 noaa-buoy PORO3,UNLA2', 'get data from station id\'s PORO3 and UNLA2')
            .example('$0 noaa-buoy stations.txt', 'get data from station id\'s listed in stations.txt file')
    }, commandNoaaBuoy)
    .example('$0 noaa-buoy --help', 'show examples of the using the noaa-buoy command')
    .help()
    .argv
;

function commandNoaaBuoy(argv) {

    let stations = argv['station_id'];

    let dateFilters = argv['date-filter'] ? argv['date-filter'] : null;
    //test if the station_id passed is actually a file
    if( fs.existsSync(stations) ){
        //if so, get the stations as a csv from the file
        stations = getStationsFromFile(stations);
    }

    raspar.scrapeBuoyData(stations ,dateFilters).then(function(buoyDataCsv){
        console.log(buoyDataCsv);
    });

}

function getStationsFromFile(fileName){
    let stationsFileData = fs.readFileSync(fileName, 'utf8');
    return stationsFileData.replace(/\n/g, ',');
}