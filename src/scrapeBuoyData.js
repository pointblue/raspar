const axios = require('axios').default;

const HEADER_ROW_1 = "SID,YY,MM,DD,hh,mm,WDIR,WSPD,GST,WVHT,DPD,APD,MWD,PRES,ATMP,WTMP,DEWP,VIS,PTDY,TIDE\n";
const HEADER_ROW_2 = "sid,yr,mo,dy,hr,mn,degT,m/s,m/s,m,sec,sec,degT,hPa,degC,degC,degC,nmi,hPa,f\n";

let IS_VERBOSE = false;

/**
 * main entry point
 * @returns {Promise<* | void>}
 */
function scrapeBuoyData(stationId, dateFilters, verbose, addHeaders){

    IS_VERBOSE = verbose;

    //if the addHeaders argument was not given, set it to true by default
    addHeaders = typeof addHeaders === 'undefined' ? true : addHeaders;

    //take a string like 2010-2015 and get and array when each item is a year or year/month that can be fetched
    dateFilters = getDateFilterArrayFromString(dateFilters);

    let stationIds = stationId.split(',');

    //TODO: Turn these strings into {{mustache}} style templates and move them to a separate config file
    let buoyBaseUrl = 'https://www.ndbc.noaa.gov/data/realtime2/';
    let buoyHistoricUrl = 'https://www.ndbc.noaa.gov/view_text_file.php?filename=';
    let buoyMonthUrl = 'https://www.ndbc.noaa.gov/view_text_file.php?filename=';
    let allPendingRequests = [];

    for(let i=0;i<stationIds.length;i++){

        //TODO: Add fetches for each historic year in the set
        for(let j=0;j<dateFilters.length;j++){
            if(dateFilters[j] === 'realtime'){
                //real time data
                //request the data to be fetched and push the return promise onto the list of all requests
                allPendingRequests.push( fetchData(buoyBaseUrl + stationIds[i] + '.txt', stationIds[i]) );
            } else if(dateFilters[j].match(/^\d\d\d\d$/)){
                // historic year data
                //request the data to be fetched and push the return promise onto the list of all requests
                allPendingRequests.push( fetchData(buoyHistoricUrl + stationIds[i].toLowerCase() + 'h' + dateFilters[j] +
                    '.txt.gz&dir=data/historical/stdmet/', stationIds[i])
                );
            } else if(dateFilters[j].match(/^\d\d\d\d\/\d\d?$/)){

                //TODO: Clean this up or put it in another function. i don't want to see a switch statement on the third
                // ordinal else if statement, yikes
                let monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                let parts = dateFilters[j].split('/');
                let year = parseInt(parts[0]);
                let month = parseInt(parts[1]);
                let monthCode = '';
                switch (month) {
                    case 10:
                        monthCode = 'a';
                        break;
                    case 11:
                        monthCode = 'b';
                        break;
                    case 12:
                        monthCode = 'v';
                        break;
                    default:
                        monthCode = month.toString();
                        break;
                }
                //https://www.ndbc.noaa.gov/view_text_file.php?filename={{station_id}}{{month_integer}}2019.txt.gz&dir=data/stdmet/{{month_3_letter_code}}/
                let url = buoyMonthUrl + stationIds[i].toLowerCase() + monthCode + year + '.txt.gz&dir=data/stdmet/' + monthName[month-1] + '/';

                allPendingRequests.push( fetchData(url, stationIds[i]) );

            } else {
                throw Error( "Date filter did not match a know pattern: " + dateFilters[j]);
            }


        }


    }





    return axios.all(allPendingRequests).then(axios.spread(function(){

        //concat the results and return
        let data = '';
        for(let i=0;i<allPendingRequests.length;i++){
            data += arguments[i] ;
        }


        //the default behavior is to add headers
        if( addHeaders ){
            return HEADER_ROW_1 + HEADER_ROW_2 + data;
        } else {
            return data;
        }


    }));

}


function fetchData (url, stationId){
    return axios.get(url)
        .then(parseResponseData)
        .then(function(data){
            if(IS_VERBOSE){
                console.log('[success loading] ' + url);
            }
            return convertDataToCsv(data, stationId);
        })
        .catch(function (error) {
            if(IS_VERBOSE){
                console.log('[failed loading] ' + url);
            }
        });
}

/**
 * gets data from the response
 * @param response
 * @returns {*}
 */
function parseResponseData(response){
    return response.data;
}

/**
 * converts the data from its existing format to a csv
 * @param data
 * @param stationId
 * @returns {void | string | *}
 */
function convertDataToCsv(data, stationId){

    //match the know data pattern and replace it with the csv version. return the output.
    return data
        //remove the header columns
        .replace(/#.+\n/g,'')
        //match any non-space character follow by one or more spaces, and reformat it as the character(s) followed by
        // a comma
        .replace(/(\S+) +/g, '$1,')
        //add the station id as the first field
        .replace(/(.+\n)/g, stationId + ',$1')

    ;
}

function getDateFilterArrayFromString(dateFilterString){
    let currentYear = (new Date()).getFullYear();
    let currentMonth = (new Date()).getMonth() + 1;
    let dateFilterParts = dateFilterString ? dateFilterString.split('-') : ['realtime'];
    //make sure you can't do weird stuff like 2009-2009
    dateFilterParts = removeDuplicates(dateFilterParts);

    let dateFilterArray = [];
    if(dateFilterParts.length > 1){
        //only use the first two parts, avoiding weird stuff like 2009-2013-2016
        dateFilterParts = [dateFilterParts[0], dateFilterParts[1]];
        let filterA = dateFilterParts[0] === 'realtime' ? currentYear : parseInt(dateFilterParts[0]);
        let filterB = dateFilterParts[1] === 'realtime' ? currentYear : parseInt(dateFilterParts[1]);
        let firstFilter, lastFilter = null;
        if(filterA>filterB){
            firstFilter = filterA;
            lastFilter = filterB;
        } else {
            firstFilter = filterB;
            lastFilter = filterA;
        }
        dateFilterArray.push(firstFilter.toString());

        //add every year for that first year to the last year
        for(let i=1;i<(firstFilter-lastFilter);i++){
            //always add after the first element so the will be sorted in descending order
            dateFilterArray.splice(1,0,(lastFilter + i).toString());
        }
        dateFilterArray.push(lastFilter.toString());

    } else {
        dateFilterArray = dateFilterParts;
    }


    if(dateFilterArray[0] === currentYear.toString()){

        //we'll need to fetch the realtime day, plus the last 10 months
        //remove the year
        dateFilterArray.splice(0,1);
        //request everything last year by month
        for(let i=1;i<=12;i++){
            dateFilterArray.splice(0,0,currentYear-1 + '/' + i);
        }
        //request everything this year by month, up to this month
        for(let i=1;i<=currentMonth;i++){
            dateFilterArray.splice(0,0,currentYear + '/' + i);
        }

        //request the latest data
        dateFilterArray.splice(0,0,'realtime');

        //add a reference to last year if it doesn't already exists. this ensure that it will be downloaded if it's archived
        if(!dateFilterArray.indexOf((currentYear-1).toString())){
            dateFilterArray.push((currentYear-1).toString());
        }

    } else if(dateFilterArray[0] === (currentYear - 1).toString()){
        //last year's data might not be 'historic' yet, so we'll have to fetch that by month as well
        //remove the year
        dateFilterArray.splice(0,1);

        for(let i=1;i<=12;i++){
            //add the year/month combo to the front of the array
            dateFilterArray.splice(0,0,(currentYear - 1).toString() + '/' + i);
        }

        //add a reference to last year if it doesn't already exists. this ensure that it will be downloaded if it's archived
        if(!dateFilterArray.indexOf((currentYear-1).toString())){
            dateFilterArray.push((currentYear-1).toString());
        }
    }

    return dateFilterArray;

}

function removeDuplicates(array) {
    return array.filter((a, b) => array.indexOf(a) === b)
}

module.exports = scrapeBuoyData;