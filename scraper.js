'use strict';

/**
 * Web Scraper
 */
// Instead of the default console.log, you could use your own augmented console.log !
// var console = require('./console');

// Url regexp from http://daringfireball.net/2010/07/improved_regex_for_matching_urls
var EXTRACT_URL_REG = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;

var request				 = require('request');

// You should (okay: could) use your OWN implementation here!
var EventEmitter		= require('events').EventEmitter;

// We create a global EventEmitter (Mediator pattern: http://en.wikipedia.org/wiki/Mediator_pattern )
var em							= new EventEmitter();

var CRAWLER_STATUS_WAITING = 0;
var CRAWLER_STATUS_WORKING = 1;

var crawler_status = CRAWLER_STATUS_WAITING;

var crawler_active = false;

var current_page = '';

// Database

//var db = require("./database.js");
var ws = require("./webserver.js");

var accepted_content_type_list = [
	'text/html',
	'text/plain'
];
/**
 * Remainder:
 * queue.push("http://..."); // add an element at the end of the queue
 * queue.shift(); // remove and get the first element of the queue (return `undefined` if the queue is empty)
 *
 * // It may be a good idea to encapsulate queue inside its own class/module and require it with:
 * var queue = require('./queue');
 */
var queue	= [];

var pages = [];
var ranks = {};
var crawler_url_contraint = '';

/**
 * Check if the string begin by the specified needle
 * @param	{String} needle
 * @return {bool}
 */
String.prototype.startsWith = function(needle)
{
	return(this.indexOf(needle) == 0);
};

/**
 * Check if the string ends by the specified needle
 * @ {String} needle
 * @return {bool}
 */
String.prototype.endsWith = function (needle) {
	return this.length >= needle.length
			&& this.substr(this.length - needle.length) == needle;
}

/**
 * Remove left and right spaces
 * @return {String}
 */
String.prototype.trim = function(){  
	return this.replace(/^\s+|\s+$/g,'');  
};  



/**
 * Get the page from `page_url`
 * @param	{String} page_url String page url to get
 *
 * `get_page` will emit
 */
function get_page(page_url){
	if (!crawler_active)
		return;

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
		 *	-> page size
		 *	-> language/server behind the web page (php ? apache ? nginx ? using X-Powered-By)
		 *	-> was compression active ? (Content-Encoding: gzip ?)
		 *	-> the Content-Type
		 */
		if(error){
			em.emit('page:error', page_url, error);
			return;
		}

		var content_type = http_client_response.headers['content-type'];
		var type_accepted = (function(){
			for (var i = 0; i < accepted_content_type_list.length; i++) {
				if (content_type.indexOf(accepted_content_type_list[i]) == -1) {
					return false;
				}
				return true;
			};
		}());
		if (type_accepted) {
			console.log('Type ' + content_type + ' accepted');
			pages.push(page_url);
			em.emit('page', page_url, html_str, true);
		} else {
			console.log('Type ' + content_type + ' refused');
			em.emit('page', page_url, html_str, false);
		}
		
	});
}

/**
 * Extract links from the web pagr
 * @param	{String} html_str String that represents the HTML page
 *
 * `extract_links` should emit an `link(` event each
 */
function extract_links(page_url, html_str, analyse){
	if (!crawler_active)
		return;

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match
	// "match" can return "null" instead of an array of url
	// So here I do "(match() || []) in order to always work on an array (and yes, that's another pattern).
	if (!analyse) {
		console.log('Extract links skipped');
		return false;
	}
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
		//db.addURL(url, function(){});
		if (pages.indexOf(url) == -1) {
		//db.existsURL(url, function(result){
			//db.addURL(url, function(){
				if (url.indexOf(crawler_url_contraint) != -1
				 && queue.indexOf(url) == -1) {
					//if (!result) {
						setTimeout(function(){
							em.emit('url', page_url, html_str, url);
						}, 1000);
					//}
				}
			//});
		//});
		}
		/*if (url.indexOf(crawler_url_contraint) != -1
		 && queue.indexOf(url) == -1
		 && pages.indexOf(url) == -1) {
			em.emit('url', page_url, html_str, url);
		}*/
		
	});

}

function handle_new_url(from_page_url, from_page_str, url){
		if (!crawler_active)
		return;

	queue.push(url);
	// ... and may be do other things like saving it to a database
	// in order to then provide a Web UI to request the data (or monitoring the scraper maybe ?)
	// You'll want to use `express` to do so
	em.emit('process_next');
}

function crawl(entry_point_url, url_contraint) {
	crawler_url_contraint = url_contraint;
	queue.push(entry_point_url);
}

function startCrawler() {
	crawler_status = CRAWLER_STATUS_WAITING;
	crawler_active = true;
	em.emit('process_next');
}

function stopCrawler() {
	crawler_active = false;
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
	if (!crawler_active)
		return;
	util.print("\u001b[2J\u001b[0;0H");
	console.log('Crawling...');
	console.log('Queue size : ' + queue.length);
	console.log('Pages crawled : ' + pages.length);
	console.log('Ranks : ' + Object.keys(ranks).length);
	if (queue.length > 0) {
		if (crawler_status == CRAWLER_STATUS_WAITING) {
			crawler_status = CRAWLER_STATUS_WORKING;
			current_page = queue.shift();
			get_page(current_page);
		} else {
			console.log('Processing : ' + current_page + '...');
		}
	} else {
		console.log("Waiting for url...");
		/*db.getURLs(10, function(result){
			console.log('Finished !');
			console.log(result);
		});*/
	}
});

function sortRanks(object, reverse) {
	var sortable = [];
	for (var item in object)
		sortable.push([item, object[item]])
	var result = sortable.sort(function(a, b) {return a[1] - b[1]});
	if (reverse) {
		return result.reverse();
	}
	return result;
}

// A simple (non-REST) API
// You may (should) want to improve it in order to provide a real-GUI for:
// - adding/removing urls to scrape
// - monitoring the crawler state
// - providing statistics like
//		- a word-cloud of the 100 most used word on the web
//		- the top 100 domain name your crawler has see
//		- the average number of link by page on the web
//		- the most used top-level-domain (TLD: http://en.wikipedia.org/wiki/Top-level_domain )
//		- ...

//console.log("Init DataBase...");
//db.init(function(){
	//console.log("Done.");

	crawl('http://www.e-doceo.net/', 'www.e-doceo.net');
	//crawl('http://www.google.com', '');

  console.log("Init WebServer...");
  ws.init(function(){
  	console.log("Done.");
  	ws.addHandle('/getURLs', function(location, res){
  		res.json(sortRanks(ranks, true).slice(0, 20));
  	});
  	ws.addHandle('/getQueueTop', function(location, res){
  		res.json(queue.slice(0, 20));
  	});
  	ws.addHandle('/getQueueLength', function(location, res){
  		res.json(queue.length);
  	});
  	ws.addHandle('/start', function(location, res){
  		startCrawler();
  	});
  	ws.addHandle('/stop', function(location, res){
  		stopCrawler();
  	});
  	ws.addHandle('/getStatus', function(location, res){
  		res.json(crawler_status);
  	});
    ws.start(3000);
    console.log("WebServer started (localhost:3000)");
  });
//});

