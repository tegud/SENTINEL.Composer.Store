var Promise = require('bluebird');
var dgram = require("dgram");
var eventEmitter = require("./events");
var _ = require('lodash');
var logger = require('./logging');
var ComposerConfig = require('./config');

function startUp(allModules) {
	logger.logInfo('Initialising Composer Builder.');

	return ComposerConfig.startConfiguredModules(eventEmitter)
		.then(function() { 
			return new Promise(function(resolve, reject) { 
				logger.logInfo('Composer Builder Running...');
				resolve(); 
			}); 
		})
		.catch(SyntaxError, function (e) {
			logger.logError("File contains invalid json");
		}).catch(Promise.OperationalError, function (e) {
			logger.logError("Unable to read file, because: " + e.message);
		}).catch(function(e) {
			logger.logError('Configuration load failed: ' + e.message);
		});
}

function getEventLogForExpiredKey(parsedData, store) {
	return store.getSessionList(parsedData);
}

function stop(listenerEventCallback) {
	return ComposerConfig.stopConfiguredModules().then(function() {
		return new Promise(function(resolve, reject) {
			resolve();
		})
	});
}

module.exports = function(config) {
	var configLoadedComplete;

	if(config) {
		configLoadedComplete = ComposerConfig.load(config);
	}
	
	return {
		loadConfigFromFile: function(fileLocation) {
			return configLoadedComplete = ComposerConfig.loadFromFile(fileLocation);
		},
		start: function() {
			return configLoadedComplete.then(startUp);
		},
		stop: stop
	};
};
