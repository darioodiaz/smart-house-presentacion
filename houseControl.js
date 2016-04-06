'use strict';
let j5 = require('johnny-five'), faye = require('faye'), twit = require('twit');

const COMMANDS = {
	'TURN_ON_LED': 'FF22DD',
	'TURN_OFF_LED': 'FF02FD',
	'OPEN_DOOR': 'FFE01F',
	'CLOSE_DOOR': 'FFA857'
};
const TWITTER_COMMANDS = {
	'prender luz': COMMANDS.TURN_ON_LED,
	'apagar luz': COMMANDS.TURN_OFF_LED,
	'abrir puerta': COMMANDS.OPEN_DOOR,
	'cerrar puerta': COMMANDS.CLOSE_DOOR
};
const SENSOR_CONSTANTS = { 'ON': 'on', 'OFF': 'off' };
const VOICE_COMMANDS = {
	'OPEN_DOOR': ['abrir la puerta', 'open the door'],
	'CLOSE_DOOR': ['cerrar la puerta', 'close the door'],
	'TURN_ON_LED': ['prender la luz', 'turn ligth on', 'prender luz', 'turn the ligth on'],
	'TURN_OFF_LED': ['apagar la luz', 'turn ligth off', 'apagar luz', 'turn the ligth off']
};

let client, redLed, doorServo, sonarNotified, ligthNotified, twitterApi;
let board = new j5.Board({ port: 'COM167' });
board.on('ready', connectToFaye);

function connectToFaye() { client = new faye.Client('http://localhost:8000/'); client.subscribe('/command', checkCommand); client.subscribe('/voice', checkVoiceCommand); initSensors(); initTwitter(); };
function initSensors() {
	redLed = new j5.Led(6); doorServo = new j5.Servo(9); doorServo.to(5);
	let sonarSensor = new j5.Proximity({ controller: 'HCSR04', pin: 7 });
	let lightSensor = new j5.Sensor({pin: 'A0', freq: 3000});
	let tempSensor = new j5.Thermometer({ controller: 'LM35', pin: 'A1', freq: 5000 });

	sonarSensor.on('data', sendSonarData.bind(sonarSensor) ); 
	lightSensor.on('data', sendLightData.bind(lightSensor) );
	tempSensor.on('data', sendTempData.bind(tempSensor) ); 
};
function initTwitter() {
	twitterApi = new twit({ consumer_key: '91gQTUHSE5CD3Feqi42cX1egF', consumer_secret: 'MmXfrFwmH13kZ9OjbBLutppi5nZ5VjfkeZfdX1R2uclJ2D3bFz', access_token: '2652793766-HsQijylemaMRFDQByyfxzLppA3qzH5dVQBI2c05', access_token_secret: 'aPriopoMm8wNT2F5aMgSTJJQxENHSxbxFJHenbHazkMVg' }); 
	let stream = twitterApi.stream('statuses/filter', { track: '#frcIoT' }); stream.on('tweet', onTweets);
};
function onTweets(tweet) {
	let command = (tweet.text.split(/#frcIoT/gi)[1]).trim().toLowerCase();
	let user = tweet.user.name; let screenName = tweet.user.screen_name; let profilePhoto = tweet.user.profile_image_url;
	checkTweetCommand(command); client.publish('/tweetCommand', { command, user, screenName, profilePhoto });
};
function checkVoiceCommand(data) {
	console.log('New voice command arrived', data);
	let voiceCommandLength, commands;
	for (let prop in VOICE_COMMANDS) {
		commands = VOICE_COMMANDS[prop]; voiceCommandLength = commands.length;
		for (let i=0; i<voiceCommandLength; i++) {  
			if (commands[i] === data.command.trim() || data.command.trim().indexOf(commands[i]) != -1) { 
				checkCommand({ command: COMMANDS[prop] }); 
				client.publish('/');
				break;
			} 
		}
	}
};
function checkTweetCommand(tweet) { console.log(tweet); checkCommand({ command: TWITTER_COMMANDS[tweet] }) };
function checkCommand(data) {
	console.log('New command arrived', data);
	switch(data.command) {
		case COMMANDS.TURN_ON_LED:
			turnLed(SENSOR_CONSTANTS.ON);
		break;
		case COMMANDS.TURN_OFF_LED:
			turnLed(SENSOR_CONSTANTS.OFF);
		break;
		case COMMANDS.OPEN_DOOR:
			door(SENSOR_CONSTANTS.ON);
		break;
		case COMMANDS.CLOSE_DOOR:
			door(SENSOR_CONSTANTS.OFF);
		break;
	}
};
function sendTempData() { 
	console.log('Temp: ', this.celsius / 2);
	client.publish('/temp', { temperature: (this.celsius / 2).toFixed(2) }); 
};
function turnLed(mode) {
	if (mode === SENSOR_CONSTANTS.ON) { redLed.on(); client.publish('/led', { status: mode }); } 
	else if (mode === SENSOR_CONSTANTS.OFF) { redLed.off(); client.publish('/led', { status: mode }); }
};
function door(mode) {
	if (mode === SENSOR_CONSTANTS.ON) { doorServo.to(170); client.publish('/door', { status: mode }); } 
	else if (mode === SENSOR_CONSTANTS.OFF) { doorServo.to(5); client.publish('/door', { status: mode }); }
};
function sendSonarData() {
	let distance = this.cm;
	if (distance === 0) { return; }
	if (distance < 20 && !sonarNotified) { 
		console.log('WARNING: something deteceted');
		client.publish('/sonar', { distance }); 
		sonarNotified = true;
		let tweetPost = 'Something detected. Distance: ' + distance + ' cm #frcIoT cerrar puerta';
		twitterApi.post('statuses/update', { status: tweetPost });
	} else if (distance > 50 && sonarNotified) {
		console.log('SONAR: back to alert mode...');
		sonarNotified = false;
	}
};
function sendLightData() { 
	console.log('Light:' , this.value);
	let intensity = this.value;
	if (intensity > 1000 && !ligthNotified) {
		redLed.on();
		client.publish('/turnLights', { intensity, status: 'on' });
		ligthNotified = true;
	} else if (intensity <= 1000 && ligthNotified) {
		redLed.off();
		client.publish('/turnLights', { intensity, status: 'off' });
		ligthNotified = false;
	}
};