var Promise = require('bluebird');
var amqp = require('amqp');
var logger = require('../logging').forModule('AMQP Publisher');

function publishEvent(exchange, routingKey, message) {
	exchange.publish(routingKey, JSON.stringify(message));
}

module.exports = function(config) {
	var connection;
	var exchange;
	var connected;
	var publishEventCallback;

	function connectionReady(resolve, reject, connection) {
		if(connected) { 
			return;
		}

		connected = true;
		logger.logInfo('Connected to Rabbit MQ');

		exchange = connection.exchange(config.exchange, { type: 'fanout', durable: true, autoDelete: false }, exchangeReady.bind(undefined, resolve));
	}

	function exchangeReady(resolve, exchange) {
		logger.logInfo('Connected to Exchange');

		publishEventCallback = publishEvent.bind(undefined, exchange, config.routing);
		eventEmitter.on('eventReadyToPublish', publishEventCallback);

		resolve();
	}

	function startUp(resolve, reject) {
		logger.logInfo('Creating AMQP publisher connection');

		var connection = amqp.createConnection({ host: config.host });

		connection.on('error', function(err) {
			logger.logError('Could not connect to: ' + config.host + ', error: ' + err);

			return reject(new Error('AMQP publisher could not connect to queue.'));
		});

		connection.on('ready', connectionReady.bind(undefined, resolve, reject, connection));

	}

	function start() {
		return new Promise(startUp);
	}
	
	return {
		start: start,
		stop: function() {
			return new Promise(function(resolve, reject) {
				eventEmitter.removeListener('eventReadyToPublish', publishEventCallback);

				resolve();
			});
		},
		publish: function(data) {
			var message = JSON.stringify(data);

			exchange.publish('composer-expired', message);
		}
	};
};
