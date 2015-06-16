var Server = require('./server');

var server = new Server();
server.loadConfigFromFile(__dirname + '/../config/composer.json').then(server.start);

