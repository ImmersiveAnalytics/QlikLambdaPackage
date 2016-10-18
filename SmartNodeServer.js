/**
 * HyperQube is an API that seeks to solve low latency challenges using Qlik Sense.
 * Example API-driven architecture to trigger data updating in ways that are:
 *	 a. event-driven
 *	 b. push" style
 *	 c. variable window size
 *	 d. incremental/partial 
 *	 e. orchestrated programmatically
 * Overall benefit, keeps smaller sized apps working together
 */
var app = require('express')();
var http = require('http').Server(app);
var noCache = require('connect-nocache')();
var io = require('socket.io')(http);
var ioclient = require('socket.io-client')('http://localhost:4444');
var d3=require('d3')
var socketio_port = '44444';
var generateFg=1;
var sensordata={};
var windowActive=1;
var eventArray=[];
var objectStepComplCount=16; //When to trigger the reload on the child
var ParentAppReloadCount=objectStepComplCount*4; //when to trigger the reload on the parent
var triggerreload=0;
var overrideTriggerReload=0;
var autoQueue=1;
var invlType='ObjectComplete';
var reloadGroup='';
var reloadId=0;
var groupReloadId=0;
var parentApp='';
var childParentApps=[];
var appData={};
var columnLabels=[];
var columns = [];
var finalAppData;
var column={};
var lastAggReadId_preload=0;
var unique_readid;
var sendData=1;
const Promise = require('bluebird');
const qsocks = require('qsocks');

io.on('connection', function(socket){
  console.log('got a connection')
  var appname;

	socket.emit('syncEventArray', eventArray);

	socket.on('generateDataYN', function(data) {
		generateFg=data;
		socket.emit('generateDataYN', generateFg);
	});
  
    socket.on('unity', function(data) {
        console.log("received msg from Unity");
    })

	socket.on('sensoremit', function(data, callback) {
		socket.broadcast.emit('bounceemit',data);
		//console.log(data)
		childParentApps.push({'parentApp':'LambdaWindow2.qvf', 'childApps':[]})
		//childParentApps[0].parentApp = 'realtimeParent.qvf';
		var cleanAppToReload=encodeURIComponent(data.appToLoad.trim());
        childParentApps[0].childApps.push(cleanAppToReload);
		//console.log(data)
	    sensordata=data;
	    lastAggReadId_preload=lastAggReadId_preload+1;
	    //console.log('last read parent: '+lastAggReadId_preload)

	    if (autoQueue === 1) {
	      
	      reloadId=reloadId+1;

	      if (invlType==='ObjectComplete' && sensordata.sensorposition === objectStepComplCount-1) {
	        eventArray.push(sensordata);
	        triggerreload=1;
	        // console.log('OBJECT COMPLETE, TRIGGER RELOAD');
	        // console.log('ParentAppReloadCount: '+ParentAppReloadCount)
	      } else {
	        eventArray.push(sensordata);
	        triggerreload=0;
	        // console.log('OBJ NC');
	        // console.log('sensordata_sensorposition: '+sensordata.sensorposition);
	        // console.log('objectStepComplCount: '+objectStepComplCount);
	      }
	    } else {
	      triggerreload=1;
	      // console.log('autoQueue notn on, reloading each time')
	    }

		if (triggerreload===1) {
		    qsocks.Connect().then(global => {
		       return global.getDefaultAppFolder()
		    })
		    .then(folder => encodeURIComponent('\\') )
		    .then(folder => {
		      return qsocks.Connect({appname: 'LambdaWindow1.qvf'})//folder + childParentApps[0].childApps[0]})
		      .then(global => {
		          return global.openDoc(data.appToLoad).then(app => app, err => {
		              if( err.code === 1002 ) return global.getActiveDoc();
		          })
		      })
		      .then(app => {
	      	    console.log('trying first reload')
		        return app.doReload(0, true, false).then(
		            () => app.doSave()
		        );
		        sensordata = {};
		        console.log('done with first reload')
		      })
		    })
		    .catch(err => console.log('first reload:'+ err))
		} else {
		  // console.log('No Reload Yet');
		}

if ( lastAggReadId_preload >= ParentAppReloadCount ) {
	
		socket.emit('testme',1);
	// console.log('PARENT RELOAD TRIGGERED');
		lastAggReadId_preload=0;
	
	childParentApps[0].parentApp = 'LambdaWindow2.qvf';
	var cleanAppToReload=encodeURIComponent(childParentApps[0].parentApp.trim());
	var cleanAppToLoadFrom=encodeURIComponent(childParentApps[0].childApps[0].trim());
	
    //Reload the parent app
	qsocks.Connect().then(global_parent => {
       return global_parent.getDefaultAppFolder()
    })
    .then(folder => encodeURIComponent('\\') )
    .then(folder => {
      return qsocks.Connect({appname: 'LambdaWindow2.qvf'})//cleanAppToReload})
      .then(global => {
      	  console.log('<<<<<<<<<--------Got PARENT APP Global')
          return global.openDoc('LambdaWindow2.qvf').then(app => app, err => {
              if( err.code === 1002 ) return global.getActiveDoc();
              console.log('<<<<<<<<<--------Opened PARENT DOC')
          })
      })
      .then(app => {
          console.log('trying second reload')
          return app.doReload(0, true, false).then(
              () => app.doSave()
            );
          console.log('<<<<<<<<<--------Reloaded PARENT APP')
      }).then( function() {
      	eventArray=[];
      	qsocks.Connect().then(global => {
	       return global.getDefaultAppFolder()
	    })
	    .then(folder => encodeURIComponent('\\') )
	    .then(folder => {
	      return qsocks.Connect({appname: 'LambdaWindow1.qvf'})
	      .then(global => {
	          return global.openDoc('LambdaWindow1.qvf').then(app => app, err => {
	              if( err.code === 1002 ) return global.getActiveDoc();
	          })
	      })
	      .then(app => {
	      	  console.log('doing post-second reload FLUSH')
	          return app.doReload(0, false, false).then(
	              () => app.doSave()

	            ).then( function() {
	            	console.log('did save on 2nd app')
	            });
	      })
	    }).catch(err => console.log('third reload: '+ err))
      })
    }).catch(err => console.log('second reload: '+ err))
}
	});
});

//Express Web Endpoints / REST API's
http.listen(socketio_port, function(){
  console.log('listening on *:'+socketio_port);
});

app.get('/lastsensordata', function (req, res) {
  if (autoQueue === 1) {
    var sensordata_string=JSON.stringify(eventArray);
  } else {
    var sensordata_string=JSON.stringify(sensordata);
  }
  res.end(sensordata_string);
  //setTimeout(clearArray, 3000);
  function clearArray() {
    eventArray=[];
    console.log('Array Cleared');
  }
  
});
//app.get('/getappdata/:appId', noCache, function (req, res) {
app.get('/getappdata/:appId', function (req, res) {
    // app.disable('etag');
    // res.writeHead(200, {
    //   'Content-Type': 'application/json',
    //   'Accept-Ranges': 'bytes',
    //   'Cache-Control': 'no-cache'
    // });
	// res.setHeader('Cache-Control', 'public, max-age=1')
	// app.cache = {}
    console.log(req.params)
    qsocks.Connect()
    .then(function(global) {
        return global.openDoc(req.params.appId)
    })
    .then(function(app) {
        console.log('got this far (app)')
        // Create a Generic Session Object
        app.createSessionObject({   
            qInfo: {
                qType: 'Chart' // We can assign it a arbitrary type
            },
            // Define the hypercube structure we will create on the fly
            // Docs: http://help.qlik.com/en-US/sense-developer/2.2/Subsystems/EngineAPI/Content/GenericObject/PropertyLevel/HyperCubeDef.htm
            qHyperCubeDef: {
                //qStateName: "$",
                qDimensions: [{
                    qDef: {
                        qFieldDefs: ['sensorposition'],
                        qFallbackTitle: 'sensorposition',
                        qType: 'I'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['read_id'],
                        qFallbackTitle: 'read_id',
                        qType: 'I'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['statuscode'],
                        qFallbackTitle: 'statuscode',
                        qType: 'A'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['objectid'],
                        qFallbackTitle: 'objectid',
                        qType: 'I'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['sensorclass'],
                        qFallbackTitle: 'sensorclass',
                        qType: 'A'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['sensorid'],
                        qFallbackTitle: 'sensorid',
                        qType: 'A'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['timestamp'],
                        qFallbackTitle: 'timestamp',
                        qType: 'I'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['timestring'],
                        qFallbackTitle: 'timestring',
                        qType: 'D'
                    }
                },
                {
                    qDef: {
                        qFieldDefs: ['conveyorsection'],
                        qFallbackTitle: 'conveyorsection',
                        qType: 'I'
                    }
                }],
                qMeasures: [{
                    qDef: {
                        qFallbackTitle: 'readvalue',
                        qType: 'I',
                        qDef: "=if(statuscode='Fail',avg(failtest),if(statuscode='Critical',100,Avg(readvalue)))",
                        qFieldLabels: [
                            "Avg Read Value"
                        ]
                    }
                }],
                qInitialDataFetch: [{
                    qWidth: 10,
                    qHeight: 1000,
                    qTop: 0,
                    qLeft: 0
                }],
                qInterColumnSortOrder : [1,0,2,3,4,5,6,7,8]
            },
            // Independent calculation using a ValueExpression
            // Docs: http://help.qlik.com/en-US/sense-developer/2.2/Subsystems/EngineAPI/Content/GenericObject/PropertyLevel/ValueExpression.htm
            total: {
                qValueExpression: { qExpr: "=Count(DISTINCT read_id)" }
            },
            myfulldynamicproperty: {
                thiscanbeanything: 'My Own Value, hurrah!'
            }
            
        }).then(function(cube) {
            //console.log(cube)
            // We have created a generic object, see docs for the full list of available methods
            // Docs: http://help.qlik.com/en-US/sense-developer/2.2/Subsystems/EngineAPI/Content/Classes/GenericObjectClass/GenericObject-class.htm
            
            // Evaluate the generic object properties and expand them into a layout.
            cube.getLayout().then(function(layout) {
                
                // // Hypercube
                
                //console.log(layout.qHyperCube.qDimensionInfo.length);
                for (var i = 0; i < layout.qHyperCube.qDimensionInfo.length; i++) {
                    var column={};
                    columnLabel= layout.qHyperCube.qDimensionInfo[i].qFallbackTitle;
                    columnType= layout.qHyperCube.qDimensionInfo[i].qType;
                    column.Label=columnLabel;
                    column.Type=columnType;
                    columnLabels.push(column);
                    //console.log(columnLabels)
                }
                for (var i = 0; i < layout.qHyperCube.qMeasureInfo.length; i++) {
                    var column={};
                    columnLabel= layout.qHyperCube.qMeasureInfo[i].qFallbackTitle;
                    columnType= layout.qHyperCube.qMeasureInfo[i].qType;
                    column.Label=columnLabel;
                    column.Type=columnType;
                    columnLabels.push(column)
                    //console.log(columnLabels)
                }
                appData.columnLabels=columnLabels;

            })

            cube.getHyperCubeData('/qHyperCubeDef',[
              {
                "qTop": 0,
                "qLeft": 0,
                "qHeight": 1000,
                "qWidth": 10
              }
            ])
            .then(function(hypercube) {
                // Try to get the data 
                appData.dataRows=[];
                
                //console.log(hypercube[0].qMatrix.length)

                for (var d = 0; d < hypercube[0].qMatrix.length; d++) {
                    // console.log("d: " + d + " - " + hypercube[0].qMatrix[d].length);
                    //appData.dataRows.push(hypercube[0].qMatrix[d][0].qText)
                    var matrixLength=hypercube[0].qMatrix[d].length;
                    //console.log('qMatrix Length: '+d+', Field Length:'+matrixLength)

                    var myObj = {};
                    for (var l = 0; l < hypercube[0].qMatrix[d].length; l++) {
                        //console.log(appData.columnLabels[l].Type);
                        if (appData.columnLabels[l].Type==='A') {
                            myObj[appData.columnLabels[l].Label] = hypercube[0].qMatrix[d][l].qText;
                        } else if (appData.columnLabels[l].Type==='I') {
                            myObj[appData.columnLabels[l].Label] = hypercube[0].qMatrix[d][l].qNum;
                        }
                    }
                    //console.log("myObj",myObj);
                    //console.log('send data: '+sendData)
                    appData.dataRows.push(myObj)
                    //delete appData.columnLabels;
                }

                finalAppData=JSON.stringify(appData);
            }).
			then(function() {
            	if (sendData===1) {
            		res.end(finalAppData);
            		
            	} else {
            		res.end('');
            		res.end(finalAppData);
            		//console.log(finalAppData)
            	}
            
                res.end(finalAppData);
                //columnLabels=[];
                //finalAppData={};
            }).then(function(){
                finalAppData={};
                columnLabels=[];
            })
        })
        .catch(function(err) { console.log(err) })
    })
});