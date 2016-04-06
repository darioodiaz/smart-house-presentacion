'use strict';

let faye = require('faye'), http = require('http'), nodeSerialPort = require('serialport');

let server = http.createServer(),
    bayeux = new faye.NodeAdapter({mount: '/', timeout: 45});

let SerialPort = nodeSerialPort.SerialPort;
let serialPort = new SerialPort('COM15', { baudrate: 9600, parser: nodeSerialPort.parsers.readline('\n') });
serialPort.on('open', onSerialPortOpen);

bayeux.attach(server);
server.listen(8000, function() { console.log('Server ON'); });

function onSerialPortOpen() {
	console.log('Serial port created');
	console.log('Waiting for data...');
	serialPort.on('data', onSerialPortData);
	function onSerialPortData(data) {
		console.log('Command received:', data);
		var key = String(data).trim();
		bayeux.getClient().publish('/command', { command: key });
	};
};