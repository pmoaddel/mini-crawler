var request = require('request-promise');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require('fs');

const START_URL = "https://www.warhammer-community.com/2019/02/12/the-rumour-daemon-engine/" //"https://www.warhammer-community.com/?s=Rumour";
const MAX_PAGES_TO_VISIT = process.argv[2] || 10;

var pagesVisited = {};
var numPagesVisited = 0;
var pagesToVisit = [];
var url = new URL(START_URL);
var baseUrl = url.protocol + "//" + url.hostname;
var rumorPages = [];

console.log(' |||||||||||||||||||||||||||||||||||||||||||||||||');
console.log(' ||||||| LOOKING FOR THOSE HOT MINI RUMORS |||||||');
console.log(' |||||||||||||||||||||||||||||||||||||||||||||||||');
console.log('START URL:', START_URL);
console.log('MAX PAGES TO VISIT:', MAX_PAGES_TO_VISIT);

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
        if(isRumorPage($)) {
            let title = $('head > title').text();
            console.log('Rumor Page Found:' + title);
            let rumorPageData = {
                imageUrls: getRumorImages($),
                pageUrl: url,
                title,
                description: $('.post-body__content').find('p').text(),
                datePosted: $('p.post-body__date').text()
            }

            rumorPages.push(rumorPageData);

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

function getRumorImages($) {
    try {
        let imgElements = $('.post-body__content').find('img');
        let imgSrcs = [];
        imgElements.each(function() {
            let src = $(this).attr('src');
            if (src) {
                imgSrcs.push(src);
            }
        });
        return imgSrcs;
    } catch (e) {
        console.log('error finding rumor image', e);
        return '';
    }
}

function isRumorPage($) {
    let title = $('head > title').text().toLowerCase();
    return title.includes('rumour') || title.includes('daemon engine')
}

function urlMeetsCommunityPostPattern(url) {
    //examples
    //https://www.warhammer-community.com/2019/03/01/the-daemon-engine-1st-march-2019-2/
    //https://www.warhammer-community.com/2019/04/23/the-rumour-engine-23rd-april-2019/
    //https://www.warhammer-community.com/2016/11/16/the-rumour-engine/
    let withoutDomain = url.replace('https://www.warhammer-community.com/', '');
    let segments = withoutDomain.split('/');
    if (segments.length < 4) {
        return false;
    }
    let year = parseInt(segments[0]);
    if (isNaN(year) || year < 2000 || year > 9999) {
        return false
    }
    let month = parseInt(segments[1]);
    if (isNaN(month) || month < 1 || month > 12) {
        return false
    }
    let day = parseInt(segments[2]);
    if (isNaN(day) || day < 1 || day > 31) {
        return false
    }

    return true;

}


function collectInternalLinks($) {
    // var relativeLinks = $(`a[href^='/'], a[href^='${START_URL}']`);
    var relativeLinks = $("a[href^='https://www.warhammer-community']")
    console.log("Found " + relativeLinks.length + " links on page");
    // console.log(relativeLinks);
    relativeLinks.each(function() {
        let page = $(this).attr('href')
        if (page in pagesVisited) {
            return;
        }
        if (!urlMeetsCommunityPostPattern(page)) {
            return;
        }

        pagesToVisit.push(page);
    });
}

async function saveResults() {
    return new Promise((resolve, reject) => {
        let timestamp = new Date().toISOString();
        let filePath = `results/${timestamp}.json`
        // create results string
        let resultString = {
            timestamp,
            numPagesVisited,
            resultsFound: rumorPages.length,
            pages: rumorPages
        };

        fs.appendFile(filePath, JSON.stringify(resultString, null, 2), (err) => {
            if(err) {
                reject(err);
            }
            console.log("Results were saved:", filePath);
            resolve();
        });
    });
}

crawl();

