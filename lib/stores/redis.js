var _ = require('lodash');
var moment = require('moment');
var redis = require('redis');
var Promise = require('bluebird');
var eventEmitter = require("../events");

var subscriptions = ["__keyevent@0*__:expired", "__keyevent@0*__:evicted"];

function storeToRedis(client, prefix, expiry, key, data) {
	var completeKey = prefix + key;

    client.set(completeKey, 1);
    client.lpush(prefix + 'list_' + key, JSON.stringify(data));
    client.expire(completeKey, expiry);
}

function parseStringDuration(durationString) {
	var durationRegex = /([0-9]+) ?([a-z]+)/i;
	var matches = durationRegex.exec(durationString);

	if(!matches) {
		return moment.duration(parseInt(durationString, 10), 'seconds');
	}

	return moment.duration(parseInt(matches[1], 10), matches[2]);
}

function manageSubscriptions(client, command, subscription) {
	client[command](subscription);
}

function matchPrefix(registeredPrefixes, key) {
	return _.chain(registeredPrefixes).filter(function(prefix) {
	  return key.indexOf(prefix) > -1;
	}).first().value();
}

function buildExpiredKey(matchingPrefix, key) {
	var prefix = matchingPrefix.substring(0, matchingPrefix.length-1);

	return {
		expiredEventTimeStamp: moment().format(),
		aggregatorType: prefix,
		expiredKey: key.substring(matchingPrefix.length),
		store: {
			name: 'redis',
			eventListKey: prefix + '_list_' + key.substring(matchingPrefix.length)
		}
	};
}

function MessageHandler() {
	var registeredPrefixes = [];
	var onExpiryManager = {
		onExpiry: function() { }
	};

	function registerPrefix(prefix) {
		registeredPrefixes.push(prefix);
	}

	function handle(channel, message, key) {
		var matchingPrefix = matchPrefix(registeredPrefixes, key);

		if(!matchingPrefix) {
			return;
		}

		eventEmitter.emit('eventReadyToPublish', buildExpiredKey(matchingPrefix, key));
	}

	return {
		handle: handle,
		registerPrefix: registerPrefix
	};
}

module.exports = function(config) { 
	var managementClient = redis.createClient(config.port, config.host);
	var storeToRedisWithClient = storeToRedis.bind(undefined, managementClient);

	var messageHandler = new MessageHandler();
	var subscriberClient = redis.createClient(config.port, config.host);
	_.each(subscriptions, manageSubscriptions.bind(undefined, subscriberClient, 'psubscribe'));

	subscriberClient.on("pmessage", messageHandler.handle);
	return {
		stop: function() {
			return new Promise(function(resolve, reject) {
				_.each(subscriptions, manageSubscriptions.bind(undefined, subscriberClient, 'punsubscribe'));

				subscriberClient.quit();
				managementClient.quit();

				resolve();
			});
		},
		configureInstance: function(instanceConfig) {
			var expiryDuration = parseStringDuration(instanceConfig.maxInactivity);

			messageHandler.registerPrefix(instanceConfig.prefix);

			return storeToRedisWithClient.bind(undefined, instanceConfig.prefix, expiryDuration.asSeconds());
		}
	};
};
