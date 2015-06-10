var pmessageHandler;
var subscribedEvents = {};

module.exports = {
	createClient: function() {
		var store = {};
		var expiries = {};

		function timeoutExpiry(key) {
			if(subscribedEvents['__keyevent@0*__:expired']) {
				pmessageHandler('__keyevent@0*__:expired', '__keyevent@0__:expired', key);
			}
		}

		return {
			psubscribe: function(event) {
				subscribedEvents[event] = true;
			},
			punsubscribe: function(event) {
				subscribedEvents[event] = false;
			},
			on: function(event, handler) {
				if(event === 'pmessage') {
					pmessageHandler = handler;
				}
			},
			quit: function() {
				pmessageHandler = undefined;
			},
			set: function(key, value) {
				store[key] = value;
			},
			lpush: function(key, value) {
				(store[key] = store[key] || []).push(value);
			},
			expire: function(key, timeout) {
				if(expiries[key]) {
					clearTimeout(expiries[key]);
				}

				expiries[key] = setTimeout(timeoutExpiry.bind(undefined, key), timeout)
			}
		};
	}
};
