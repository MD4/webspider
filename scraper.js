'use strict';

/**
 * Web Scraper
 */
// Instead of the default console.log, you could use your own augmented console.log !
// var console = require('./console');

// Url regexp from http://daringfireball.net/2010/07/improved_regex_for_matching_urls
var EXTRACT_URL_REG = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;
var PORT            = 3000;

var request         = require('request');

// See: http://expressjs.com/guide.html
var express         = require('express');
var app             = express();

// You should (okay: could) use your OWN implementation here!
var EventEmitter    = require('events').EventEmitter;

// We create a global EventEmitter (Mediator pattern: http://en.wikipedia.org/wiki/Mediator_pattern )
var em              = new EventEmitter();

var CRAWLER_STATUS_WAITING = 0;
var CRAWLER_STATUS_WORKING = 1;

var crawler_status = CRAWLER_STATUS_WAITING;

var current_page = '';

// Database

var db = require("./database.js");

/**
 * Remainder:
 * queue.push("http://..."); // add an element at the end of the queue
 * queue.shift(); // remove and get the first element of the queue (return `undefined` if the queue is empty)
 *
 * // It may be a good idea to encapsulate queue inside its own class/module and require it with:
 * var queue = require('./queue');
 */
var queue        = [];

var pages = [];
var ranks = [];
var crawler_url_contraint = '';
/**
 * Check if the string begin by the specified needle
 * @param  {String} needle
 * @return {bool}
 */
String.prototype.startsWith = function(needle)
{
    return(this.indexOf(needle) == 0);
};


/**
 * Get the page from `page_url`
 * @param  {String} page_url String page url to get
 *
 * `get_page` will emit
 */
function get_page(page_url){
  em.emit('page:scraping', page_url);

  // See: https://github.com/mikeal/request
  request({
    url:page_url,
  }, function(error, http_client_response, html_str){
    /**
     * The callback argument gets 3 arguments.
     * The first is an error when applicable (usually from the http.Client option not the http.ClientRequest object).
     * The second is an http.ClientResponse object.
     * The third is the response body String or Buffer.
     */

    /**
     * You may improve what get_page is returning by:
     * - emitting HTTP headers information like:
     *  -> page size
     *  -> language/server behind the web page (php ? apache ? nginx ? using X-Powered-By)
     *  -> was compression active ? (Content-Encoding: gzip ?)
     *  -> the Content-Type
     */

    if(error){
      em.emit('page:error', page_url, error);
      return;
    }

    em.emit('page', page_url, html_str);
    pages.push(page_url);
  });
}

/**
 * Extract links from the web pagr
 * @param  {String} html_str String that represents the HTML page
 *
 * `extract_links` should emit an `link(` event each
 */
function extract_links(page_url, html_str){
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match
  // "match" can return "null" instead of an array of url
  // So here I do "(match() || []) in order to always work on an array (and yes, that's another pattern).
  (html_str.match(EXTRACT_URL_REG) || []).forEach(function(url){
    // see: http://nodejs.org/api/all.html#all_emitter_emit_event_arg1_arg2
    // Here you could improve the code in order to:
    // - check if we already crawled this url
    // - ...
    //if (url.startsWith(crawler_url_contraint)) {
    if (!ranks[url]) {
      ranks[url] = 0;
    }
    ranks[url]++;
    if (url.indexOf(crawler_url_contraint) != -1
     && queue.indexOf(url) == -1
     && pages.indexOf(url) == -1) {
      em.emit('url', page_url, html_str, url);
    }
  });

}

function handle_new_url(from_page_url, from_page_str, url){
  // Add the url to the queue
  queue.push(url);
  // ... and may be do other things like saving it to a database
  // in order to then provide a Web UI to request the data (or monitoring the scraper maybe ?)
  // You'll want to use `express` to do so
  em.emit('process_next');
}

function crawl(entry_point_url, url_contraint) {
  crawler_url_contraint = url_contraint;
  queue.push(entry_point_url);
  em.emit('process_next');
}

em.on('page:scraping', function(page_url){
  console.log('Loading... ', page_url);
});

// Listen to events, see: http://nodejs.org/api/all.html#all_emitter_on_event_listener
em.on('page', function(page_url, html_str){
  console.log('We got a new page!', page_url);
  crawler_status = CRAWLER_STATUS_WAITING;
  em.emit('process_next');
});

em.on('page:error', function(page_url, error){
  console.error('Oops an error occured on', page_url, ' : ', error);
  crawler_status = CRAWLER_STATUS_WAITING;
  em.emit('process_next');
});

em.on('page', extract_links);

var util = require('util');
em.on('url', function(page_url, html_str, url){
  //console.log('We got a link! ', url);
});

em.on('url', handle_new_url);

em.on('process_next', function(){
  util.print("\u001b[2J\u001b[0;0H");
  console.log('Crawling...');
  console.log('Queue size : ' + queue.length);
  console.log('Pages crawled : ' + pages.length);
  if (queue.length > 0) {
    if (crawler_status == CRAWLER_STATUS_WAITING) {
      crawler_status = CRAWLER_STATUS_WORKING;
      current_page = queue.shift();
      get_page(current_page);
    } else {
      console.log('Processing : ' + current_page + '...');
    }
  } else {
    console.log('Finished !');
    console.log(ranks);
  }
});

// A simple (non-REST) API
// You may (should) want to improve it in order to provide a real-GUI for:
// - adding/removing urls to scrape
// - monitoring the crawler state
// - providing statistics like
//    - a word-cloud of the 100 most used word on the web
//    - the top 100 domain name your crawler has see
//    - the average number of link by page on the web
//    - the most used top-level-domain (TLD: http://en.wikipedia.org/wiki/Top-level_domain )
//    - ...

// You should extract all the following "api" related code into its own NodeJS module and require it with
// var api = require('./api');
// api.listen(PORT);
/*
app.get('/', function(req, res){
  // See: http://expressjs.com/api.html#res.json
  res.json(200, {
    title:'YOHMC - Your Own Home Made Crawler',
    endpoints:[{
      url:'http://127.0.0.1:'+PORT+'/queue/size',
      details:'the current crawler queue size'
    }, {
      url:'http://127.0.0.1:'+PORT+'/queue/add?url=http%3A//voila.fr',
      details:'immediately start a `get_page` on voila.fr.'
    }, {
      url:'http://127.0.0.1:'+PORT+'/queue/list',
      details:'the current crawler queue list.'
    }]
  });
});

app.get('/queue/size', function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  res.json(200, {queue:{length:queue.length}});
});

app.get('/queue/add', function(req, res){
  var url = req.param('url');
  get_page(url);
  res.json(200, {
    queue:{
      added:url,
      length:queue.length,
    }
  });
});

app.get('/queue/list', function(req, res){
  res.json(200, {
    queue:{
      length:queue.length,
      urls:queue
    }
  });
});

app.listen(PORT);
console.log('Web UI Listening on port '+PORT);
*/
// #debug Start the crawler with a link
//crawl('http://twitter.com/FGRibreau', 'twitter.com');
//crawl('http://www.speedrabbitpizza.com', 'www.speedrabbitpizza.com');
//crawl('https://github.com/MD4', '//github.com');
//crawl('http://www.e-doceo.net/', '//www.e-doceo.net')

db.init(function(){
  db.addURL('test1', function(){
    db.addURL('test2', function(){
      db.addURL('test3', function(){
        db.getURLs(function(results){
          console.log(results);
          db.existsURL('test2', function(result){
            console.log(result);
          });
          db.existsURL('test4', function(result){
            console.log(result);
          });
        });
      });
    });
  });
});