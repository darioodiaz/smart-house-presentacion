var client, mustListen, recognition, language;
$(document).on('ready', onReady);
function onReady() {
	$('#btn_led').on('click', onLedClick);
	$('#btn_door').on('click', onDoorClick);
	$('#btn_voice').on('click', onVoiceClick);
	$('#lst_languages').on('change', onSelectLanguages);
	language = $('#lst_languages option:selected').val();
	connectToServer();
};
function connectToServer() {
	client = new Faye.Client('http://localhost:8000/');
	$("#panel_status").removeClass("panel-danger").addClass("panel-success");
	$("#status_icon").removeClass("fa-close").addClass("fa-check-circle");
	$("#status_text").text("CONECTADO");
	client.subscribe('/sonar', onSonarTopic);
	client.subscribe('/led', onLedTopic);
	client.subscribe('/door', onDoorTopic);
	client.subscribe('/temp', onTempTopic);
	client.subscribe('/tweetCommand', onTweetTopic);
	client.subscribe('/turnLights', onTurnLigthsTopic);
	listenVoiceCommands();
};
function putHouseMessage(msj) {
	var houseMessage = $('<li>');
	houseMessage
		.addClass('list-group-item')
		.text(msj);
	$('#lst_house').append(houseMessage);
	$('#lst_house').prop("scrollTop", $('#lst_house').prop("scrollHeight") );
};

function onTurnLigthsTopic(data) {
	var msj = 'Las luces estan ' + data.status + ' debido a que la intensidad es: ' + data.intensity;
	onLedTopic(data);
	putHouseMessage(msj);
};
function onSonarTopic(data) { putHouseMessage('ADVERTENCIA: algo se detecto. Distancia: ' + data.distance + ' cm'); };
function onLedTopic(data) { 
	var newClass = data.status === 'on' ? 'btn-success' : 'btn-danger';
	$('#btn_led')
		.removeClass('btn-success btn-danger')
		.addClass(newClass)		
		.attr('data-status', data.status);
	$('#led_txt').text( ' ' + data.status.toUpperCase() );
};
function onDoorTopic(data) { 
	var newClass = data.status === 'off' ? 'btn-primary' : 'btn-danger';
	$('#btn_door')
		.removeClass('btn-primary btn-danger')
		.addClass(newClass)		
		.attr('data-status', data.status)
		.find('.fa')
			.removeClass('fa-lock fa-unlock-alt')
			.addClass( data.status === 'off' ? 'fa-lock' : 'fa-unlock-alt' );

	$('#door_txt').text( data.status === 'off' ? ' CERRADO' : ' ABIERTO' );
};
function onTempTopic(data) { $('#txt_temp').text(data.temperature + ' °C'); };
function onTweetTopic(data) {
	var tweetProfile = $('<img>');
	tweetProfile.attr('src', data.profilePhoto)

	var tweetBody = $('<span>');
	tweetBody.addClass("tweet-command");
	tweetBody.text(' ' + data.user.concat(': ', data.command) );

	var tweet = $('<li>');
	tweet.addClass('list-group-item').append(tweetProfile).append(tweetBody)

	$('#lst_tweets').append(tweet);
	$('#lst_tweets').prop("scrollTop", $('#lst_tweets').prop("scrollHeight") );
};

function onLedClick(e) {
	var status = $(this).attr('data-status');
	client.publish('/command', { command: status === 'off' ? 'FF22DD' : 'FF02FD' });
};
function onDoorClick(e) {
	var status = $(this).attr('data-status');
	client.publish('/command', { command: status === 'off' ? 'FFE01F' : 'FFA857' });
};
function onVoiceClick(e) {
	var status = $(this).attr('data-status');
	var newClass = status === 'off' ? 'btn-success' : 'btn-warning';
	$('#btn_voice')
		.removeClass('btn-success btn-warning')
		.addClass(newClass)		
		.attr('data-status', status === 'off' ? 'on' : 'off')
		.find('.fa')
			.removeClass('fa-microphone fa-microphone-slash')
			.addClass( status === 'off' ? 'fa-microphone' : 'fa-microphone-slash' );
	$('#voice_txt').text( ' ' + $('#btn_voice').attr('data-status').toUpperCase() );
	mustListen = (status === 'off');
	listenVoiceCommands();
};

function onSelectLanguages() { language = $('#lst_languages option:selected').val(); recognition.stop(); recognition.lang = language; listenVoiceCommands(); };
function listenVoiceCommands() {
	if (recognition && !mustListen) {
		recognition.stop();
	} else if (!recognition) {
		recognition = new webkitSpeechRecognition();
		recognition.continuous = true;

		recognition.onerror = function(event) { console.warn('Voice commands error: ', event); };
		recognition.onresult = function(event) {
			var voiceCommand;
			for (var i = event.resultIndex; i < event.results.length; i++) {
				if (event.results[i].isFinal) {
					voiceCommand = (event.results[i][0].transcript).toLowerCase();
				}
			}
			if (voiceCommand) {
				console.log('Voice command: ', voiceCommand);
				client.publish('/voice', { command: voiceCommand });
			}
		};
	}
	recognition.lang = language;
	if (mustListen) {
		recognition.start();
	}
};