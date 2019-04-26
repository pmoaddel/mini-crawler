var request = require('request-promise');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require('fs');


const START_URL = "https://www.warhammer-community.com/2019/04/16/the-rumour-engine-tuesday-16th-april/" //"https://www.warhammer-community.com/?s=Rumour";
const MAX_PAGES_TO_VISIT = 1000;

var pagesVisited = {};
var numPagesVisited = 0;
var pagesToVisit = [];
var url = new URL(START_URL);
var baseUrl = url.protocol + "//" + url.hostname;
var rumourImages = {};

process.on('SIGINT', function () {
    console.log('execution interrupted');
    saveResults()
    .then(() => {
        process.exit(0);    
    }).catch((e) => {
        // process.exit(0);        
    });
});

async function crawl() {
    pagesToVisit.push(START_URL);
    try {
        while (true) {
            if(numPagesVisited >= MAX_PAGES_TO_VISIT) {
                console.log("Reached max limit of number of pages to visit.");
                break;
            }
            let nextPage = pagesToVisit.pop();

            if (!nextPage) {
                // we are done
                console.log('no more pages to visit');
                break;
            }

            if (nextPage.includes('.pdf')) {
                // don't look at all the pdfs on the website
                continue;
            }

            // New page we haven't visited
            await visitPage(nextPage);
        }
    } catch (e) {
        console.error('an error occured while crawling', e);
    } finally {
        await saveResults();    
    }    
}



async function visitPage(url) {
    // Add page to our set
    pagesVisited[url] = true;
    numPagesVisited++;


    // Make the request
    console.log("Visiting page " + url, 'num visited', numPagesVisited);

    var options = {
        uri: url,
        transform: function (body) {
            return cheerio.load(body);
        }
    };
    try {
        let $ = await request(options);
        let rumourImage = checkForRumourImage($);
        if(rumourImage) {
            console.log('Rumour Image found:' + rumourImage);
            rumourImages.push(rumourImage);
        }
        collectInternalLinks($);

    } catch (err) {
        console.error('error getting page', err);
    }
}

function searchForWord($, word) {
  var bodyText = $('html > body').text().toLowerCase();
  return(bodyText.indexOf(word.toLowerCase()) !== -1);
}

function checkForRumourImage($) {
    let rumourImage = $("img[src*=RumourEngine]");
    if (rumourImage.length) {
        return rumourImage[0].attribs.src;
    }
    return '';
}


function collectInternalLinks($) {
    // var relativeLinks = $(`a[href^='/'], a[href^='${START_URL}']`);
    var relativeLinks = $("a[href^='https://www.warhammer-community']")
    console.log("Found " + relativeLinks.length + " links on page");
    // console.log(relativeLinks);
    relativeLinks.each(function() {
        let page = $(this).attr('href')
        if (!(page in pagesVisited)) {
            pagesToVisit.push(page);
        }
    });
}

async function saveResults() {
    return new Promise((resolve, reject) => {
        let timestamp = new Date().toISOString();
        let filePath = `results/${timestamp}.txt`
        // create results string
        let resultString = '';
        rumourImages.forEach(function(imageUrl) {
            resultString += imageUrl + '\n';
        });

        fs.appendFile(filePath, resultString, (err) => {
            if(err) {
                reject(err);
            }
            console.log("Results were saved:", filePath);
            resolve();
        });
    });
}

crawl();

