var Promise = require('bluebird');
var amqp = require('amqp');
var logger = require('../logging').forModule('AMQP Listener');

module.exports = function AmqpListener(config, handleMessage) {
	var connection;
	var connected;

	function connectionReady(handleMessage, resolve, reject, connection) {
		if(connected) { 
			return;
		}

		connected = true;
		logger.logInfo('Connected to Rabbit MQ');

		connection.queue(config.queue, { autoDelete: false }, queueReady.bind(undefined, handleMessage, resolve));
	}

	function queueReady(handleMessage, resolve, queue) {
		logger.logInfo('Connected to Queue');
		queue.bind(config.exchange, config.routing);
		
		queue.subscribe({ ack: true }, messageReceived.bind(undefined, handleMessage, queue));

		resolve();
	}

	function messageReceived(handleMessage, queue, msg) {
		handleMessage(msg.data);
		queue.shift();
	}

	function startUp(eventEmitter, resolve, reject) {
		var connection = amqp.createConnection({ host: config.host });

		connection.on('ready', connectionReady.bind(undefined, handleMessage, resolve, reject, connection));
	}

	function start(eventEmitter) {
		return new Promise(startUp.bind(undefined, eventEmitter));
	}

	return {
		start: start
	};
};
