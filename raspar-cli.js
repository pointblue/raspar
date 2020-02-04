#!/usr/bin/env node

let raspar = require('.');
let fs = require('fs');
let moment = require('moment');

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
            .option('d', {
                alias: 'date-filter',
                requiresArg: true,
                describe: 'a year, range of years, or \'realtime\'',
                type: 'string'
            })
            .option('o', {
                alias:'output-file',
                requiresArg: true,
                describe: 'a file to save output to. will be created if it does not exist.',
                type: 'string'
            })
            .option('without-headers', {
                "boolean": true,
                describe: 'save data without column headers'
            })
            .example('$0 noaa-buoy PORO3', 'get data from station id PORO3')
            .example('$0 noaa-buoy PORO3,UNLA2', 'get data from station id\'s PORO3 and UNLA2')
            .example('$0 noaa-buoy stations.txt', 'get data from station id\'s listed in stations.txt file (one id per line)')
            .example('$0 noaa-buoy stations.txt --output-file=my_output.csv', 'send data output to file my_output.csv')
            .example('$0 noaa-buoy PORO3 --date-filter=2015', 'limit to data from 2015')
            .example('$0 noaa-buoy PORO3 --date-filter=2018-2015', 'limit to data from 2018-2015')
            .example('$0 noaa-buoy PORO3 --date-filter=2015-realtime', 'limit to data from 2015-realtime')
    }, commandNoaaBuoy)
    .example('$0 noaa-buoy --help', 'buoy data - help using the `noaa-buoy` command')
    .help()
    .argv
;

function commandNoaaBuoy(argv) {

    let stations = argv['station_id'];

    let dateFilters = argv['date-filter'] ? argv['date-filter'] : null;

    let defaultOutputFile = createNoaaBuoyOutputName(stations, dateFilters);
    let outputFile = argv['output-file'] ? argv['output-file'] : defaultOutputFile;

    //if the without-headers flag is set (true), then the `addHeaders` variable is false
    let addHeaders = ! argv['without-headers'];

    //test if the station_id passed is actually a file
    if( fs.existsSync(stations) ){
        //if so, get the stations as a csv from the file
        stations = getStationsFromFile(stations);
    }

    raspar.scrapeBuoyData(stations , dateFilters, addHeaders).then(function(buoyDataCsv){
        fs.writeFileSync(outputFile, buoyDataCsv);
        console.log('raspar success!');
        console.log('Output file created at: ' + outputFile);
    });

}

function getStationsFromFile(fileName){
    let stationsFileData = fs.readFileSync(fileName, 'utf8');
    return stationsFileData.replace(/\n/g, ',');
}

function createNoaaBuoyOutputName(stations, dateFilters){
    let stationsPart = stations.replace(',', '-');
    let dateFiltersPart = dateFilters ? dateFilters : 'realtime';
    return 'noaa-buoy_' + stationsPart + '_' + dateFiltersPart + '_' + moment().format('YYYYMMDDHHmmssZZ') + '.csv';
}