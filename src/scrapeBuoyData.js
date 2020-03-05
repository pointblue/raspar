const axios = require('axios').default;
const mustache = require('mustache');


function NoaaBuoyScraper(stationId, options){

    const HEADER_ROW_1 = "SID,YY,MM,DD,hh,mm,WDIR,WSPD,GST,WVHT,DPD,APD,MWD,PRES,ATMP,WTMP,DEWP,VIS,PTDY,TIDE\n";
    const HEADER_ROW_2 = "sid,yr,mo,dy,hr,mn,degT,m/s,m/s,m,sec,sec,degT,hPa,degC,degC,degC,nmi,hPa,f\n";

    const REALTIME_TEMPLATE = 'https://www.ndbc.noaa.gov/data/realtime2/{{stationIdUpperCase}}.txt';
    const HISTORIC_TEMPLATE = 'https://www.ndbc.noaa.gov/view_text_file.php?filename={{stationIdLowerCase}}h{{year}}.txt.gz&dir=data/historical/stdmet/';
    const MONTH_TEMPLATE = 'https://www.ndbc.noaa.gov/view_text_file.php?filename={{stationIdLowerCase}}{{monthCode}}{{year}}.txt.gz&dir=data/stdmet/{{monthShortName}}/';

    const MONTH_SHORT_NAME = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    let isVerbose = options.hasOwnProperty('verbose') ? options['verbose'] : false;
    let addHeaders = options.hasOwnProperty('addHeaders') ? options['addHeaders'] : true;
    let dateFilters = options.hasOwnProperty('dateFilters') ? options['dateFilters'] : 'realtime';

    this.scrape = scrape;

    function scrape(){

        //take a string like 2010-2015 and get and array when each item is a year or year/month that can be fetched
        let allDateFilters = getDatesFromRange(dateFilters);

        let stationIds = stationId.split(',');

        let allPendingRequests = [];
        let templateOptions = {};

        for(let i=0;i<stationIds.length;i++){

            //Add fetches for each historic year in the set
            for(let j=0;j<allDateFilters.length;j++){

                if(allDateFilters[j] === 'realtime'){
                    //real time data
                    templateOptions['stationIdUpperCase'] = stationIds[i].toUpperCase();
                    // noinspection JSUnresolvedFunction
                    let url = mustache.render(REALTIME_TEMPLATE, templateOptions);
                    allPendingRequests.push( fetchData( url, stationIds[i]) );
                } else if(allDateFilters[j].match(/^\d\d\d\d$/)){
                    // historic year data
                    templateOptions = {
                        stationIdLowerCase: stationIds[i].toLowerCase(),
                        year: allDateFilters[j]
                    };
                    // noinspection JSUnresolvedFunction
                    let url = mustache.render(HISTORIC_TEMPLATE, templateOptions);
                    allPendingRequests.push( fetchData( url, stationIds[i]) );
                } else if(allDateFilters[j].match(/^\d\d\d\d\/\d\d?$/)){
                    // monthly data
                    let parts = allDateFilters[j].split('/');
                    let year = parseInt(parts[0]);
                    let month = parseInt(parts[1]);
                    let monthCode = getMonthCode(month);
                    templateOptions = {
                        stationIdLowerCase: stationIds[i].toLowerCase(),
                        monthCode: monthCode,
                        year: year,
                        monthShortName: MONTH_SHORT_NAME[month-1]
                    };

                    // noinspection JSUnresolvedFunction
                    let url = mustache.render(MONTH_TEMPLATE, templateOptions);
                    allPendingRequests.push( fetchData( url, stationIds[i]) );
                } else {
                    throw Error( "Date filter did not match a know pattern: " + allDateFilters[j]);
                }


            }


        }


        // after all requests are finished
        return axios.all(allPendingRequests).then(axios.spread(function(){
            // send the data for each to our spread function

            //concat the value of each function argument to data
            let data = '';
            for(let i=0;i<allPendingRequests.length;i++){
                data += arguments[i] ;
            }


            //add headers unless the user explicitly excluded them
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
                if(isVerbose){
                    console.log('[success loading] ' + url);
                }
                return convertDataToCsv(data, stationId);
            })
            .catch(function (error) {
                if(isVerbose){
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

    /**
     * Create an array of date strings as YYYY, YYYY/MM, or realtime
     * @param dateFilterString
     * @returns {[]}
     */
    function getDatesFromRange(dateFilterString){

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


        if(dateFilterArray[0] === currentYear.toString() || dateFilterArray[0] === (currentYear - 1).toString()){

            //remove the year
            dateFilterArray.splice(0,1);
            //request everything last year by month
            addMonthFilters(currentYear-1, dateFilterArray);

            if(dateFilterArray[0] === currentYear.toString()){
                //request everything this year by month, up to this month
                addMonthFilters(currentYear, dateFilterArray, currentMonth);

                //request the latest data
                dateFilterArray.splice(0,0,'realtime');
            }

            //add a reference to last year if it doesn't already exists. this ensure that it will be downloaded if it's archived
            if(!dateFilterArray.indexOf((currentYear-1).toString())){
                dateFilterArray.push((currentYear-1).toString());
            }

        }

        return dateFilterArray;

    }

    function addMonthFilters(year, dateFilterArray, stopMonth){
        stopMonth = typeof stopMonth === 'undefined' ? 12 : stopMonth;
        for(let i=1;i<=stopMonth;i++){
            dateFilterArray.splice(0,0, year + '/' + i);
        }
    }

    function getMonthCode(month){
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
        return monthCode;
    }

    function removeDuplicates(array) {
        return array.filter((a, b) => array.indexOf(a) === b)
    }


}

/**
 * main entry point
 * @returns {Promise<* | void>}
 */
function scrapeBuoyData(stationId, options){

    let noaaBuoyScraper = new NoaaBuoyScraper(stationId, options);

    return noaaBuoyScraper.scrape();

}


module.exports = scrapeBuoyData;