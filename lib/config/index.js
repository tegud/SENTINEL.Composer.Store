var Promise = require('bluebird');
var fs = Promise.promisifyAll(require("fs"));
var _ = require('lodash');
var logger = require('../logging').forModule('Config');
var eventEmitter = require("../events");
var allListeners = require('../listeners');
var allPublishers = require('../publishers');

var allStores = {};
var startHandlers = [];
var stopHandlers = [];

function loadFromFile(file) {
	return fs.readFileAsync(file).then(JSON.parse);
}

function createStoreFromConfig(allStores, storeConfig, storeName) {
	allStores[storeName] = require('../stores/' + storeConfig.type)(storeConfig);

	return allStores;
}

function createListenerFromConfig(listenerConfig) {
	if(!allListeners[listenerConfig.type]) {
		return reject(new Error('Could not find listener of type: ' + listenerConfig.type));
	}
	return new allListeners[listenerConfig.type](listenerConfig);
}

function createPublisherFromConfig(config){
	if(!allPublishers[config.type]) {
		return reject(new Error('Could not find publisher of type: ' + config.type));
	}

	return new allPublishers[config.type](config);
}

function getKeyFromAggregator(keyProperties, parsedData) {
	if(typeof keyProperties === 'string') {
		return parsedData[keyProperties];
	}

	return _.chain(keyProperties).map(function(property) {
		return _.get(parsedData, property);
	}).filter(function(value) { return typeof value !== 'undefined'; }).first().value();
}

function generateKeyAndStore(aggregator, parsedData) {
	var key = getKeyFromAggregator(aggregator.key, parsedData);//aggregator.keyFunction(parsedData);
	if(key && _.contains(aggregator.subscribedTypes, parsedData.type)) {
		aggregator.store(key, parsedData);
	}
}

function load(config) {
	return new Promise(function(resolve, reject) {
		if(config.logLevel) {
			logger.setLevel(config.logLevel);
		}

		allStores = _.reduce(config.stores, createStoreFromConfig, {});
		var aggregators = config.aggregators;
		var listeners = _.map(config.listeners, createListenerFromConfig);
		var publishers = _.map(config.publishers, createPublisherFromConfig);

		aggregators.forEach(function(aggregator) {
			aggregator.store = allStores[aggregator.store.name].configureInstance(aggregator.store);

			var listenHandler = generateKeyAndStore.bind(undefined, aggregator);

			eventEmitter.on('listenerEventReceived', listenHandler);

			aggregator.stop = function() {
				eventEmitter.removeListener('listenerEventReceived', listenHandler);
			};
		}); 

		var allModules = _.map(allStores, function(store) { return store; }).concat(listeners, publishers, _.map(aggregators, function(aggregator) { return aggregator; }));

		startHandlers = _.chain(allModules).pluck('start').filter(function(stopHandler) { return stopHandler; }).value();
		stopHandlers = _.chain(allModules).pluck('stop').filter(function(stopHandler) { return stopHandler; }).value();

		resolve({
			listeners: listeners, 
			publishers: publishers,
			stores: allStores
		});
	});
}

function executeHandlers(handlers) {
	return handlers.map(function(handler) { return handler(); });
}

module.exports = {
	load: load,
	loadFromFile: function(file) {
		return loadFromFile(file).then(load);
	},
	lookupStore: function(storeName) {
		return new Promise(function(resolve, reject) {
			if(!allStores[storeName]) {
				return reject(new Error('Store "' + storeName + '" not found'));
			}

			resolve(allStores[storeName]);
		});
	},
	startConfiguredModules: function() {
		logger.logInfo('Starting ' + startHandlers.length + ' module handler' + (startHandlers.length !== 1 ? 's' : ''));

		return Promise.all(executeHandlers(startHandlers));
	},
	stopConfiguredModules: function() {
		logger.logInfo('Stopping ' + stopHandlers.length + ' module handler' + (stopHandlers.length !== 1 ? 's' : ''));
		
		return Promise.all(executeHandlers(stopHandlers));
	}
};
