var server = require('./server');

new server({
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
			factory: 'session',
			redisStore: {
				maxInactivityUnits: 'minutes',
				maxInactivity: 15,
				prefix: 'session_'
			}
		}
	]
}).start();
