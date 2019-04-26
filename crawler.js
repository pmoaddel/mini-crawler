var request = require('request-promise');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require('fs');


const START_URL = "https://www.warhammer-community.com/2019/04/16/the-rumour-engine-tuesday-16th-april/" //"https://www.warhammer-community.com/?s=Rumour";
const MAX_PAGES_TO_VISIT = 10;

var pagesVisited = {};
var numPagesVisited = 0;
var pagesToVisit = [];
var url = new URL(START_URL);
var baseUrl = url.protocol + "//" + url.hostname;
var rumourImages = [];

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

            if (nextPage in pagesVisited) {
                // We've already visited this page, so repeat the crawl
                continue;
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
        saveResults();    
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
        // console.log('url add', $(this).attr('href'));
        pagesToVisit.push($(this).attr('href'));
    });
}

function saveResults() {
    var timestamp = new Date().toISOString();
    var filePath = `results/${timestamp}.txt`
    // create results string
    resultString = '';
    rumourImages.forEach(function(imageUrl) {
        resultString += imageUrl + '\n';
    });

    fs.appendFile(filePath, resultString, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("Results were saved:", filePath);
    });
}

crawl();

