var ioclient = require('socket.io-client')('http://localhost:44444');
var uniqueRandomArray=require('random-item');
const Promise = require('bluebird');
const qsocks = require('qsocks');
var intervalGenSecs=2.;
var intervalGenMs=intervalGenSecs*1000; //every x milliseconds for typical sensor readings
var sensorClassArray = new Array('A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P');
var sensorClass=uniqueRandomArray(sensorClassArray);
sensorIdArray=new Array('A123', 'B234', 'C535', 'D254','E559','F023','G737', 'H344', 'I743', 'J554','K534','L024','M232','N020','O255','P723');
var sensorId = uniqueRandomArray(sensorIdArray);
var readValue=Math.floor(Math.random() * 6) + 1;
var readValuePrev1=0;
var timeStamp=Math.floor(Date.now() / 1000);
var timeString=new Date();
var secondsPassed=0;
var eventArray=[];
var positionNum=0;
var triggerreload=0;
var anomalyFg=0;
var generateFg=1;
var objectId=1;
var statusCode='';
var statusCodePrev='';
var failValue=0;
var failValuePrev=0;
var readCounter=0;
var readCounterBtwFail=0;
var failValueTest=0;
var meetsFailCriteria=0;
var conveyorSection=0;
var appToLoad='LambdaWindow1.qvf';

ioclient.on('generateDataYN', function(data) {
    generateFg=data;
});

ioclient.on('unity', function() {
	console.log("client received msg from unity");
});


setInterval(function() { console.log("It's been "+intervalGenSecs+" seconds, sending out a normal reading"); 
	if (generateFg===1) {
		readCounter=readCounter+1;
		conveyorSection=1;
		positionNum=positionNum+1;
		if (positionNum <= 4) {
			conveyorSection=1;
		} 
		if (positionNum >=5 && positionNum <= 8 ) {
			conveyorSection=2;
		} else 
		if (positionNum >= 9 && positionNum <= 12 ) {
			conveyorSection=3;
		} 
		if (positionNum >= 13 && positionNum <= 16 ) {
			conveyorSection=4;
		} 
		if (positionNum >= 17) {
			positionNum=1;
			objectId=objectId+1;
			conveyorSection=1;
		} 

		readValue=0;
		sensorIdArray=sensorIdArray;
		sensorId = sensorIdArray[positionNum-1];
		sensorClass=sensorClassArray[positionNum-1];
		readValue=Math.floor(Math.random() * 6) + 1;
		timeStamp=Math.floor(Date.now() / 1000);
		timeString=new Date();

		if (readValue >= 1 && readValue <= 2 ) {
			statusCode='OK'
		} else if (readValue >= 3 && readValue <= 4 ) {
			statusCode='Med'
		} else if (readValue >= 5 && readValue <= 6 ) {
			statusCode='High'
		}

		if (statusCodePrev==='High' && readValue >=3 && positionNum < 16) 
		// .... If reading is a MEDIUM or HIGH readvalue that immedialy follows a HIGH readvalue. Also and precedes the last sensor in the conveyor belt.
		{   
			failValueTest=Math.floor(Math.random() * 25) + 1;
			meetsFailCriteria=1;
			//console.log('FailValueTest: '+failValueTest);
			//console.log('MEETSFAIL!!: '+meetsFailCriteria);
			failValue=failValueTest; //Roll the dice - 1 in 25 chance it will be a FAIL..
		} else {
			meetsFailCriteria=0;
			failValue=0;
			failValueTest=0;
		}

		if (failValue >= 24) {
			
			statusCode='Fail';

			if (readCounterBtwFail <= 20 && readCounterBtwFail > 0 && failValue >= 24) {
				readValue=100;
				statusCode='Critical';
				//console.log('CRITICAL ERROR DETECTED!!');
			} 

			readCounterBtwFail=readCounterBtwFail+1;

		} else {
			failValue=0;
		}

		if (readCounterBtwFail > 0 && readCounterBtwFail <= 20 ) {
			readCounterBtwFail=readCounterBtwFail+1;
		}

		if (readCounterBtwFail > 20) {
				readCounterBtwFail=0;
			} 


		ioclient.emit('sensoremit', 
			{
				'sensorid':sensorId,
				'timestamp': timeStamp, 
				'timestring': timeString,
				'readvalue':readValue, 
				'sensorclass':sensorClass, 
				'sensorposition':positionNum, 
				'triggerreload':1, 
				'objectid':objectId, 
				'statuscode':statusCode,
				'read_id':readCounter,
				'failtest':failValueTest,
				'meetsfail':meetsFailCriteria,
				'failvalueprev':failValuePrev,
				'readbtwfail':readCounterBtwFail,
				'conveyorsection':conveyorSection,
				'appToLoad':appToLoad
			});
		
		readValuePrev1=readValue;
        statusCodePrev=statusCode;

    } else {
		console.log('not generating sensor data');
	}

}, intervalGenMs);