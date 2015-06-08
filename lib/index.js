var server = require('./server');

new server({
	stores: {
		'redis': {
			type: 'redis',
			host: '192.168.50.7',
			port: 6379
		}
	},
	listeners: [
		{ type: 'amqp', host: '10.44.72.40', queue: 'composer-in' }
	],
	publishers: [
		{ type: 'amqp', host: '10.44.72.40', exchange: 'composer-expired' }
	],
	aggregators: [
		{
			type: 'session',
			subscribedTypes: ['lr_varnish_request', 'domain_events', 'lr_errors', 'paymentprocessor_logging'],
			keyFunction: function(data) { 
				return data['sessionId'] || (data['data'] == undefined ? undefined : data['data']['TLRGSessionId']); 
			},
			store: {
				name: 'redis',
				maxInactivity: '30minutes',
				prefix: 'session_'
			}
		}
	]
}).start();
