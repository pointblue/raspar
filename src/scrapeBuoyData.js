const axios = require('axios').default;

/**
 * main entry point
 * @returns {Promise<* | void>}
 */
function scrapeBuoyData(stationId, dateFilters){

    //TODO: Give user a way to specify years
    dateFilters = getDateFilterArrayFromString(dateFilters);

    let stationIds = stationId.split(',');

    //TODO: Allow users to enter a file name that will provide a list of station id's
    // each id will be pulled and concat'd into a single file. each record with have
    // the station id prepended to it so that it can be reference in the final output

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

        return data;
    }));

}


function fetchData (url, stationId){
    return axios.get(url)
        .then(parseData)
        .then(function(data){
            return convertDataToCsv(data, stationId);
        })
        .catch(function (error) {
            // handle error
            // all errors should be skipped. it might just be data that's not available
            // log errors in an actual log
        });
}

/**
 * gets data from the response
 * @param response
 * @returns {*}
 */
function parseData(response){
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

    //TODO: Remove any duplicate from the dateFilterParts
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
        let countYear = currentYear-1;
        let countMonth = currentMonth;

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
        //get 10 months of data starting 12 months ago
        // for(let i=0;i<=10;i++){
        //     countMonth = currentMonth+i;
        //
        //     //TODO: Should this really be splitting between years? I don't even know how they release data between years
        //     //if this is the first time we went over 12
        //     if(countMonth === 13){
        //         //increment the year
        //         countYear++;
        //     }
        //     //if we're over 12 months, subtract twelve
        //     if(countMonth > 12){
        //         countMonth = countMonth - 12
        //     }
        //     dateFilterArray.splice(0,0,countYear + '/' + countMonth);
        // }

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