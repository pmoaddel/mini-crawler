var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require('fs');


var START_URL = "https://www.warhammer-community.com/2019/04/16/the-rumour-engine-tuesday-16th-april/" //"https://www.warhammer-community.com/?s=Rumour";
var SEARCH_WORD = "rumour";
var MAX_PAGES_TO_VISIT = 10000;

var pagesVisited = {};
var numPagesVisited = 0;
var pagesToVisit = [];
var url = new URL(START_URL);
var baseUrl = url.protocol + "//" + url.hostname;
var rumourImages = [];

pagesToVisit.push(START_URL);
crawl();

function crawl() {
    if(numPagesVisited >= MAX_PAGES_TO_VISIT) {
        console.log("Reached max limit of number of pages to visit.");
        saveResults();
        return;
    }
    // console.log('pagesToVisit', pagesToVisit);
    var nextPage = pagesToVisit.pop();

    if (!nextPage) {
        // we are done
        console.log('no more pages to visit');
        saveResults();
        return;
    }

    if (nextPage in pagesVisited) {
        // We've already visited this page, so repeat the crawl
        return crawl();
    }

    if (nextPage.includes('.pdf')) {
        // don't look at all the pdfs on the website
        return crawl();
    }

    // New page we haven't visited
    visitPage(nextPage, crawl);
}

function visitPage(url, callback) {
    // Add page to our set
    pagesVisited[url] = true;
    numPagesVisited++;

    // Make the request
    console.log("Visiting page " + url);
    request(url, function(error, response, body) {
        // Check status code (200 is HTTP OK)
        console.log("Status code: " + response.statusCode);
        if(response.statusCode !== 200) {
            callback();
            return;
        }
        // Parse the document body
        var $ = cheerio.load(body);
        var rumourImage = checkForRumourImage($);
        if(rumourImage) {
            console.log('Rumour Image found:' + rumourImage);
            rumourImages.push(rumourImage);
        }

        collectInternalLinks($);
        // In this short program, our callback is just calling crawl()
        callback();
    });
}

function searchForWord($, word) {
  var bodyText = $('html > body').text().toLowerCase();
  return(bodyText.indexOf(word.toLowerCase()) !== -1);
}

function checkForRumourImage($) {
    var rumourImage = $("img[src*=RumourEngine]");
    debugger;
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
    var timestamp = new Date().getTime();
    // create results string
    resultString = '';
    rumourImages.forEach(function(imageUrl) {
        resultString += imageUrl + '\n';
    });

    fs.appendFile(`results/${timestamp}.txt`, resultString, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("Results were saved");
    });
}
