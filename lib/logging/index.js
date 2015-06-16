var moment = require('moment');

var DEBUG = 'DEBUG';
var INFO = 'INFO';
var ERROR = 'ERROR';

var availableLevels = {};

availableLevels[DEBUG] = 0;
availableLevels[INFO] = 1;
availableLevels[ERROR] = 2;

var logLevel = 'INFO';

function log(level, module, message) {
	if(availableLevels[level] >= availableLevels[logLevel]) {
		console.log('[' + moment().format() + '] [' + level + ']' + (module ? ' [' + module + ']' : '') + ' ' + message);
	}
}

module.exports = {
	setLevel: function(level) {
		logLevel = level;
	},
	log: log,
	forModule: function(module) {
		return {
			logDebug: log.bind(undefined, DEBUG, module),
			logInfo: log.bind(undefined, INFO, module),
			logError: log.bind(undefined, ERROR, module)
		};
	},
	logDebug: log.bind(undefined, DEBUG, undefined),
	logInfo: log.bind(undefined, INFO, undefined),
	logError: log.bind(undefined, ERROR, undefined)
};
