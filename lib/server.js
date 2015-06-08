var Promise = require('bluebird');
var dgram = require("dgram");
var _ = require('lodash');
var logger = require('./logging');
var allListeners = require('./listeners');
var allPublishers = require('./publishers');

function parseMessage(msg) {
	var data = msg.toString('utf-8');

	return JSON.parse(data);
}

function publish(publishers, key, data) {
	_.each(publishers, function(publisher) {
		publisher.publish(key);
	});
}

function getModuleStartPromise(module) {
	return module.start();
}

module.exports = function(config) {
	var aggregators = config.aggregators;

	if(config.logLevel) {
		logger.setLevel(config.logLevel);
	}

	var listeners = _.map(config.listeners, function(config) {
		return new allListeners[config.type](config, handleMessage);
	});

	var publishers = _.map(config.publishers, function(config) {
		return new allPublishers[config.type](config);
	});
	
	var handleExpiry = publish.bind(undefined, publishers);

	var stores = _.reduce(config.stores, function(allStores, storeConfig, storeName) {
		allStores[storeName] = require('./stores/' + storeConfig.type)(storeConfig);

		allStores[storeName].setExpiryHandler(handleExpiry);

		return allStores;
	}, {});

	aggregators.forEach(function(aggregator) {
		aggregator.store = stores[aggregator.store.name].configureInstance(aggregator.store);
	});

	function handleMessage(msg) {
		var parsedData = parseMessage(msg);

		aggregators.forEach(function(aggregator) {
			var key = aggregator.keyFunction(parsedData);
			if(key && _.contains(aggregator.subscribedTypes, parsedData.type)) {
				aggregator.store(key, parsedData);
			}
		});
	}

	return {
		start: function() {
			logger.logInfo('Initialising SENTINEL.Composer.');

			return new Promise(function(resolve, reject) {
				var moduleStartPromises = _.map(listeners.concat(publishers), getModuleStartPromise);

				Promise.all(moduleStartPromises).then(resolve.bind(undefined, undefined));
			});
		},
		stop: function() {
			return new Promise(function(resolve, reject) {
				var allModules = listeners.concat(publishers).concat(_.map(stores, function(module) { return module; }));
				var moduleStopPromises = _.chain(allModules).map(function(module) {
					if(!module.stop) {
						return;
					}

					return module.stop();
				}).filter(function(module) { return module; }).value();

				Promise.all(moduleStopPromises).then(function() { resolve(); });
			});
		}
	};
};
