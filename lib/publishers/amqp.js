var Promise = require('bluebird');
var amqp = require('amqp');
var logger = require('../logging');

module.exports = function(config) {
	var connection;
	var exchange;
	var connected;

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

		resolve();
	}

	function startUp(resolve, reject) {
		logger.logInfo('Creating AMQP publisher connection');

		var connection = amqp.createConnection({ host: config.host });

		connection.on('error', function() {
			logger.logInfo('Could not connect to queue.');

		});
		connection.on('ready', connectionReady.bind(undefined, resolve, reject, connection));
	}

	function start() {
		return new Promise(startUp);
	}
	
	return {
		start: start,
		publish: function(data) {
			var message = JSON.stringify(data);

			exchange.publish('composer-expired', message);
		}
	};
};
