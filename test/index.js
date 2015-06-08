var expect = require('expect.js');
var proxyquire = require('proxyquire');
var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var fs = require('fs');
var Server = proxyquire('../lib/server', {
	'./stores/redis': proxyquire('../lib/stores/redis', {
		'redis': require('./fake-redis')
	})
});
var _ = require('lodash');

describe('SENTINEL.Composer.Store', function() {
	describe('event is inputted via udp', function() {
		var udpClient;
		var server;
		var port = 1234;

		beforeEach(function(done) {
			server = new Server({
				stores: {
					'redis': {
						type: 'redis',
						host: '192.168.50.7',
						port: 6379
					}
				},
				listeners: [
					{ type: 'udp', port: 1234 }
				],
				publishers: [
					{ type: 'udp', host: '127.0.0.1', port: 1235 }
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
							maxInactivity: '1second',
							prefix: 'session_'
						}
					}
				]
			});

			server.start().then(done);

			udpClient = dgram.createSocket("udp4");

			udpClient.bind(1235);

			eventEmitter = new EventEmitter();
		});

		afterEach(function(done) {
			udpClient.close();
			eventEmitter.removeAllListeners();

			server.stop().then(done);

			server = null;
		});

		function sendTest(testData, gapBetween) {
			var currentTestItem = JSON.stringify(testData.shift());
			var message = new Buffer(currentTestItem);

			udpClient.send(message, 0, message.length, port, "localhost", function() {
				if(testData.length) {
					setTimeout(function() {
						sendTest(testData, gapBetween);
					}, gapBetween);
				}
			});
		}

		function loadTestData(fileName) {
			var testData = fs.readFileSync(__dirname + '/data/' + fileName, 'utf-8');

			return JSON.parse(testData);
		}

		function cloneData(data) {
			return JSON.parse(JSON.stringify(data));
		}

		describe('stores request and emits identifier once expiry occurs', function() {
			it('sets expiredKey', function(done) {
				var testData = loadTestData('three.json');
				var called;

				sendTest(testData, 5);
				
				udpClient.on("message", function messageReceived(msg) {

					var data = msg.toString('utf-8');
					var parsedData = JSON.parse(data);

					expect(parsedData.expiredKey).to.be('104e9439-63de-4373-95ff-6dfa365e4951');
					done();

					called = true;
				});
			});	

			it('sets aggregatorType', function(done) {
				var testData = loadTestData('three.json');
				var called;

				sendTest(testData, 5);

				udpClient.on("message", function messageReceived(msg) {

					var data = msg.toString('utf-8');
					var parsedData = JSON.parse(data);

					expect(parsedData.aggregatorType).to.be('session');
					done();

					called = true;
				});
			});	
		});
	});
});
