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
				console.log("Creating DB...");
				db.run("									\
					CREATE TABLE page (						\
					id INTEGER PRIMARY KEY AUTOINCREMENT,	\
					url TEXT NOT NULL,						\
					rank INT NOT NULL						\
					);										\
				", callback);
			} else {
				callback();
			}
		});
	},

	getURLs: function(resultCallback) {
		var results = [];
		db.each(
			"SELECT * FROM page",
			function(err, row) {
				results.push(row);
			},
			function(){
				resultCallback(results);
			}
		);
	},

	addURL: function(url, callback) {
		var query = db.prepare("INSERT INTO page VALUES (NULL,?,?)");
		query.run(url, 0, callback);
		query.finalize();
	},

	existsURL: function(url, resultCallback) {
		var exists = false;
		var query = db.prepare("SELECT count(*) as existingURL FROM page WHERE url=?");
		query.get(
			url,
			function(err, result) {
				resultCallback(result.existingURL == 1);
			}
		);
	}

}