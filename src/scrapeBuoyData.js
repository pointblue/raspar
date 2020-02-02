const axios = require('axios').default;

/**
 * main entry point
 * @returns {Promise<* | void>}
 */
function scrapeBuoyData(stationId){

    //TODO: Give user a way to specify years
    let years = ['realtime'];

    let stationIds = stationId.split(',');

    //TODO: Allow users to enter a file name that will provide a list of station id's
    // each id will be pulled and concat'd into a single file. each record with have
    // the station id prepended to it so that it can be reference in the final output

    let buoyBaseUrl = 'https://www.ndbc.noaa.gov/data/realtime2/';
    let buoyHistoricUrl = 'https://www.ndbc.noaa.gov/view_text_file.php?filename=';
    let allPendingRequests = [];

    for(let i=0;i<stationIds.length;i++){

        //TODO: Add fetches for each historic year in the set
        for(let j=0;j<years.length;j++){
            if(years[j] === 'realtime'){
                //real time data
                //request the data to be fetched and push the return promise onto the list of all requests
                allPendingRequests.push( fetchData(buoyBaseUrl + stationIds[i] + '.txt', stationIds[i]) );
            } else {
                // historic year data
                //request the data to be fetched and push the return promise onto the list of all requests
                allPendingRequests.push( fetchData(buoyHistoricUrl + stationIds[i].toLowerCase() + 'h' + years[j] +
                    '.txt.gz&dir=data/historical/stdmet/', stationIds[i])
                );
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
            console.log(error);
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



module.exports = scrapeBuoyData;