var Promise = require('bluebird');
var dgram = require("dgram");
var eventEmitter = require("../events");

function publishEvent(client, host, port, data) {
	var message = new Buffer(JSON.stringify(data));

	client.send(message, 0, message.length, port, host, function() { });
}

module.exports = function(options) {
	var udpClient;
	var publishEventCallback;
	
	return {
		start: function() {
			return new Promise(function(resolve, reject) {
				udpClient = dgram.createSocket("udp4");
				
				publishEventCallback = publishEvent.bind(undefined, udpClient, options.host, options.port);
				eventEmitter.on('eventReadyToPublish', publishEventCallback);

				resolve();
			});
		},
		stop: function() {
			return new Promise(function(resolve, reject) {
				eventEmitter.removeListener('eventReadyToPublish', publishEventCallback);

				resolve();
			});
		}
	};
};
