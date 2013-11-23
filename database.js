/**
 * Database module using SQLite3
 * Provides database loading & manipulation methods
 * Author : Martin DEQUATREMARE
 */
var fs = require("fs");
var dbFileName = "data.db";
var dbFileExists = fs.existsSync(dbFileName);
	
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFileName);

module.exports = {

	init: function(callback) {
		db.serialize(function() {
			if(!dbFileExists) {
				db.run("										\
					CREATE TABLE page (							\
						id INTEGER PRIMARY KEY AUTOINCREMENT,	\
						url TEXT NOT NULL,						\
						rank INT NOT NULL						\
					);											\
				", function(){
					db.run("										\
						CREATE TABLE queue (						\
							id INTEGER PRIMARY KEY AUTOINCREMENT,	\
							url TEXT NOT NULL						\
						);											\
					", callback);
				});
			} else {
				callback();
			}
		});
	},

	/**
	 *	URL METHODS
	 */

	getURLs: function(limit, resultCallback) {
		var results = [];
		db.each(
			"SELECT * FROM page ORDER by rank DESC LIMIT ?",
			limit,
			function(err, row) {
				results.push(row);
			},
			function(){
				resultCallback(results);
			}
		);
	},

	getURLsCount: function(resultCallback) {
		var query = db.prepare("SELECT count(*) as URLCount FROM page WHERE url=?");
		query.get(
			url,
			function(err, result) {
				resultCallback(result.URLCount);
			}
		);
	},

	addURL: function(url, callback) {
		var self = this;
		this.existsURL(url, function(result){
			if (result) {
				//console.log('url inc');
				self.incRank(url, callback);
			} else {
				var query = db.prepare("INSERT INTO page VALUES (NULL,?,?)");
				query.run(url, 1, callback);
				//console.log('url added');
			}
		});
		
	},

	incRank: function(url, callback) {
		var query = db.prepare("UPDATE page SET rank = rank + 1 WHERE url=?");
		query.run(url, callback);
	},

	existsURL: function(url, resultCallback) {
		var exists = false;
		var query = db.prepare("SELECT count(*) as existingURL FROM page WHERE url=?");
		query.get(
			url,
			function(err, result) {
				resultCallback(result.existingURL >= 1);
			}
		);
	},

	/**
	 *	QUEUE METHODS
	 */

	 queueAdd: function(url, callback) {
	 	var query = db.prepare("INSERT INTO queue VALUES (NULL,?)");
		query.run(url, callback);
	 },

	 queueShift: function(resultCallback) {
	 	var query = db.prepare("SELECT * FROM queue ORDER BY id ASC");
		query.get(function(err, result) {
			resultCallback(result);
			var query = db.prepare("DELETE FROM queue WHERE id=?");
			query.run(result.id);
		});
	 },

	 queueSize: function(resultCallback) {
		var query = db.prepare("SELECT count(*) as queueSize FROM queue");
		query.get(function(err, result) {
			resultCallback(result.queueSize);
		});
	 },

	 queueGet: function(resultCallback) {
	 	var query = db.prepare("SELECT * FROM queue");
	 	var results = [];
		query.each(function(err, row) {
			results.push(row);
		}, function(){
			resultCallback(results);
		});
	 },

	 queueURLExists: function(url, resultCallback) {
	 	var exists = false;
		var query = db.prepare("SELECT count(*) as existingURL FROM queue WHERE url=?");
		query.get(
			url,
			function(err, result) {
				resultCallback(result.existingURL >= 1);
			}
		);
	 }

}