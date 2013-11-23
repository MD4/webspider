/**
 * Webserver module using Express
 * Send web content to users
 * Author : Martin DEQUATREMARE
 */

var express	= require('express');
var app		= express();
var fs		= require("fs");
var path	= require("path");

var handles	= [];

var enumContentTypes = {
	'.html':	"text/html",
	'.css':		"text/css",
	'.js':		"text/javascript"
};

function getDisplayContent(location, resultCallback) {
	fs.exists(location, function(exists) {
		console.log('GET ' + location);
		if(!exists) {
			resultCallback("404 Not Found\n", 404, {"Content-Type": "text/plain"});
			return;
		}
		if (fs.statSync(location).isDirectory()) location += '/index.html';
		fs.readFile(location, "binary", function(err, file) {
			if(err) {				
				resultCallback(err + "\n", 500, {"Content-Type": "text/plain"});
				return;
			}
			var contentType = enumContentTypes[path.extname(location)];
			resultCallback(file, 200, {"Content-Type": contentType});
		});
	});
}

module.exports = {

	init: function(callback) {
		app.get('/', function(req, res){
			getDisplayContent('display', function(content, code, headers){
				res.writeHead(code, headers);
				res.write(content, "binary");
				res.end();
			});
		});

		app.get(/(.*)/, function(req, res){
			var location = req.params[0];
			if (location in handles) {
				handles[location](location, res);
			} else {
				getDisplayContent('display' + location, function(content, code, headers){
					res.writeHead(code, headers);
					res.write(content, "binary");
					res.end();
				});
			}
		});

		callback();
	},

	start: function(port, callback) {
		app.listen(port);
		if (callback) {
			callback();
		}
	},

	addHandle: function(location, handleCallback) {
		handles[location] = handleCallback;
	}
}