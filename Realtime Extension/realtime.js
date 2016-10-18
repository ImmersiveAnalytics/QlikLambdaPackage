var socketio_port = 44444;
var dataqueue=[];
var data=[];

require.config({
        paths: {
            socketio: 'http://localhost:'+socketio_port+'/socket.io/socket.io'
        }
});

define(["jquery", "socketio", "qlik", "css!./css/realtime.css", "./js/d3.min", "./js/senseD3utils", "./js/senseUtils"], function($, io, qlik, cssContent) {
    $("<style>").html(cssContent).appendTo("head");
    return {
        initialProperties: {
            version: 1.0,
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [],
                qInitialDataFetch: [{
                    qWidth: 10,
                    qHeight: 50
                }]
            }
        },
            definition: {
                type: "items",
                component: "accordion",
                items: {
                    dimensions: {
                        uses: "dimensions",
                        min: 0,
                        max: 1
                    },
                    measures: {
                        uses: "measures",
                        min: 0,
                        max: 1
                    },
                    sorting: {
                        uses: "sorting"
                    },
                    settings: {
                        uses: "settings",
                        items: {
                            dateFormatDropDown: {
                                type: "string",
                                component: "dropdown",
                                label: "Date/Time Format",
                                ref: "dateformat",
                                options: [ 
                                    {label:"YYYY-MM-DDThh:mm:ss.msZ", value: "%Y-%m-%dT%H:%M:%S.%LZ"},
                                    {label:"YYYY-MM-DD hh:mm:ss", value:"%Y-%m-%d %H:%M:%S"},
                                    {label:"DD/MM/YYYY hh:mm:ss", value:"%d/%m/%Y %H:%M:%S"},
                                    {label:"DD-MM-YYYY hh:mm", value:"%d-%m-%Y %H:%M"},
                                    {label:"DD/MM/YYYY hh:mm", value:"%d/%m/%Y %H:%M"},
                                    {label:"DD/MM/YYYY", value:"%d/%m/%Y"},
                                    {label:"DD-MM-YYYY", value:"%d-%m-%Y"},
                                    {label:"YYYY-MMM", value:"%Y-%b"},
                                    {label:"MM/YYYY", value:"%m/%Y"},
                                    {label:"hh:mm", value:"%H:%M"},
                                    {label:"YYYY", value:"%Y"}],
                                defaultValue: "%Y-%m-%dT%H:%M:%S.%LZ"
                            },
                            lineStyleDropDown: {
                                type: "string",
                                component: "dropdown",
                                label: "Line Style",
                                ref: "lineStyle",
                                options: [
                                    {label:"Linear",value:"linear"},
                                    {label:"Spline",value:"basis"},
                                    {label:"Steps Before",value:"step-before"},
                                    {label:"Steps After",value:"step-after"},
                                    {label:"Tight Spline",value:"bundle"},
                                    {label:"Cubic Monotone",value:"monotone"},
                                    {label:"Cardinal",value:"cardinal-open"}],
                                defaultValue: "linear"
                            },
                            showDataPoints: { 
                                type: "boolean",
                                component: "switch",
                                label: "Show Data Points",
                                ref: "showDataPoints",
                                options: [{ value: false,   label: "No"}, { value: true,    label: "Yes"}],
                                defaultValue: false
                            },
                            padData: { 
                                type: "boolean",
                                component: "switch",
                                label: "Pad Dates",
                                ref: "padData",
                                options: [{ value: false,   label: "No"}, { value: true,    label: "Yes"}],
                                defaultValue: false
                            },
                            showValuesOnMouseOver: { 
                                type: "boolean",
                                component: "switch",
                                label: "MouseOver",
                                ref: "showValuesOnMouseOver",
                                options: [{ value: false,   label: "No"}, { value: true,    label: "Yes"}],
                                defaultValue: true
                            },
                            showFill: { 
                                type: "boolean",
                                component: "switch",
                                label: "Fill Area",
                                ref: "showFill",
                                options: [{ value: false,   label: "No"}, { value: true,    label: "Yes"}],
                                defaultValue: false
                            }

                        }
                    }
                }
            },
        snapshot: {
            canTakeSnapshot: true
        },
        paint: function($element, layout) {
                var self = this;

                senseUtils.extendLayout(layout, self);

                // SET UP THE D3 SCALES, AXES etc
                var x = d3.time.scale()
                    .range([0, width]);

                var y = d3.scale.linear()
                    .range([height, 0]);

                y.domain([0, height]);

                var xAxis = d3.svg.axis()
                    .scale(x)
                    .orient("bottom");

                var yAxis = d3.svg.axis()
                    .scale(y)
                    .orient("left");
                    
                // line and area functions used later to plot the data (they interpret the date/time format)
                var line = d3.svg.line()
                    .interpolate(layout.lineStyle)
                    .x(function(d) { return x(d.x); })
                    .y(function(d) { return y(d.y); });

                var poly = d3.svg.area()
                    .interpolate(layout.lineStyle)
                    .x(function(d) { return x(d.x); })
                    .y0(height)
                    .y1(function(d) { return y(d.y); });    

                x.domain(d3.extent(data, function(d) { return d.x; }));
                y.domain(d3.extent(data, function(d) { return d.y; })); 

                var label_width;

                var bisectDate = d3.bisector(function(d) { return d.x; }).left;

                $element.html("<div id='notifybar'></div>");

                // SOCKET.IO STUFF:

                var socket = io.connect('http://localhost:'+socketio_port);

                var socketstatus;

                if (socket) {
                    socketstatus = 'Connected';
                } else {
                    socketstatus = 'Not Connected';
                }

                socket.on( 'error', function(data) {
                        console.log('error on socket.io');
                        console.log(data);
                        $("#notifybar")[0].innerText='Error on Socket.io'
                });

                socket.on( 'disconnect', function(data) {
                        console.log('disconnected from socket.io');
                        console.log(data);
                        $("#notifybar")[0].innerText='Disconnected from Socket.io';
                });

                socket.on( 'Reconnected', function(data) {
                        console.log('Reconnected to socket.io');
                        $("#notifybar")[0].innerText='Reconnected to Socket.io';
                });

                socket.on( 'connect', function(err) {
                    console.log('connected to socket.io');
                    socket.on('bounceemit', function(sensordata) {

                        //Only look at a rolling n window size once we get to n reads
                        var n = 40;
                        dataqueue.push(sensordata);
                        if (dataqueue.length > n) {
                            dataqueue.shift();
                        }
                        
                        data = dataqueue.map(function(d) {
                            console.log(d)
                            var readvaluexform=0;
                            if(d.statuscode==='Fail'){readvaluexform=d.failtest} else if (d.statuscode==='Critical') {readvaluexform=d.failtest} else {readvaluexform=d.readvalue}
                            return {
                                "x":parseDate(d.timestring), 
                                "y":readvaluexform//d.readvalue//
                            }
                        });

                        data.sort(function(a, b) {
                            return a.x - b.x;
                        });

                        label_width = getLabelWidth(yAxis,svg, d3.min(data, function (d) { return d.y }), d3.max(data, function (d) { return d.y })); 
                
                        if (layout.padData) {
                            // ADD ZERO VALUES WHERE THERE ARE GAPS IN THE DATA

                            // ASSUMES the data is sorted low to high
                            var date_range = d3.time.days(
                                d3.time.minute.floor(data[0].x), 
                            new Date(+d3.time.minute.ceil(data[data.length - 1].x)+1), 1); // the +1 stops the last record being omitted
                            console.log('date range: ',date_range)
                            if (date_range === undefined || date_range.length == 0) {
                                console.log('date range?: ',d3.time.minute.floor(data[0].x));
                                console.info("Unable to interpret date range (" + d3.time.minute.floor(data[0].x)); }
                            else {
                                  var m = d3.map(data, function(d) {
                                  return d.x
                                });
                                var newData = date_range.map(function(bucket) {
                                  if (m.get(bucket)) {
                    //              console.info("passing over " + bucket);
                                    return m.get(bucket);
                                  } else {
                    //              console.info("creating value for " + bucket);
                                    return {
                                      x: bucket,
                                      y: 0
                                    };
                                  }
                                });
                                var numAdded = newData.length - data.length;
                                console.info("Added " + numAdded + " rows of padding");
                                data = newData;
                                newData = null;
                                }
                            }

                        if (data[0].x == null) { // Either no data or error converting Date/Time, so display message and skip render
                            //console.info(data.length + " items to plot");
                            if (data.length == 1) { console.info("single item: " + data[0].x + "," + data[0].y); }
                            if (data.length == 0) { // no data, so do nothing
                            } 
                            else {
                                svg.append("text")
                                .attr("class", "error")
                                .text("Error converting Date/Time. Check Format")
                                .attr("text-anchor", "middle")
                                .style("fill","#444")
                                .attr("transform", "translate(" + width/2 + "," + height/2 + ")")
                            }
                        }
                        else {  
                            // MAIN RENDER CODE:
                            
                            // Update the margins, plot width, and x scale range based on the y axis label size
                            margin.left = left_margin + label_width;
                            width = ext_width - (margin.left + margin.right );

                            d3.select("#" + id + "Transformer")
                                .attr("width", width)
                                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                            x = d3.time.scale()
                                .range([0, width]);

                            y = d3.scale.linear()
                                .range([height, 0]);

                            y.domain([0, height]);

                            xAxis = d3.svg.axis()
                                .scale(x)
                                .orient("bottom");

                            yAxis = d3.svg.axis()
                                .scale(y)
                                .orient("left");    

                            x.domain(d3.extent(data, function(d) { return d.x; }));
                            y.domain(d3.extent(data, function(d) { return d.y; })); 

                            // DRAW FILL FIRST SO THAT AXES & LINE GO ON TOP
                            if(layout.showFill) {
                                svg.select(".area")   // change the line
                                    .attr("d", poly(data));
                            }
                                
                            svg.select(".x.axis")
                                .call(xAxis);

                            svg.select(".y.axis")
                                .call(yAxis);

                            // svg.selectAll(".dot")
                            //   .data(data)
                            //   .enter().append("circle")
                            //   .attr("class", "dot")
                            //   .attr("r", 2)
                            //   .attr("cx", function(d) { return x(d.x); })
                            //   .attr("cy", function(d) { return y(d.y); })
                            //   .style("fill", "blue")       
                                    
                            if (data.length>0) { 
                                svg.select(".line")   // change the line
                                    .attr("d", line(data));
                            } 
                            else {
                                svg.selectAll(".dot")
                                  .data(data)
                                  .enter().append("circle")
                                  .attr("class", "dot")
                                  .attr("r", 2)
                                  .attr("cx", function(d) { return x(d.x); })
                                  .attr("cy", function(d) { return y(d.y); })
                                  .style("fill", "blue")          ;
                            }
                            if (layout.showDataPoints) {
                                svg.selectAll(".dot")
                                  .data(data)
                                  .enter().append("circle")
                                  .attr("class", "dot")
                                  .attr("r", 2)
                                  .attr("cx", function(d) { return x(d.x); })
                                  .attr("cy", function(d) { return y(d.y); })
                                  .style("fill", "steelblue")         ;
                            }

                            if (layout.showValuesOnMouseOver) {
                            // Display value when mouse hovers over chart 
                                var focus = svg.append("g")
                                  .attr("class", "focus")
                                  .style("display", "none")
                                  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


                              focus.append("circle")
                                  .attr("class","tooltip")
                                  .attr("r", 4.5)
                                  .style("fill", "none")
                                  .style("stroke", "#444")
                                  .style("stroke-width","1.5px");

                              focus.append("text")
                                  .attr("class","tooltip")
                                  .attr("x", 9)
                                  .attr("dy", ".35em");
                              svg.append("rect")
                                  .attr("class", "overlay")
                                  .attr("width", width )
                                  .attr("height", height)
                                  .attr("stroke","green")
                                  .attr("stroke-width","2")
                                  .style("opacity", "0")
                                  .on("mouseover", function() { focus.style("display", null); })
                                  .on("mouseout", function() { focus.style("display", "none"); })
                                  .on("mousemove", mousemove);

                              bisectDate = d3.bisector(function(d) { return d.x; }).left
                            
                              function mousemove() {
                                var x0 = x.invert(d3.mouse(this)[0]),
                                    i = bisectDate(data, x0, 1)
                                    d0 = data[i - 1],
                                    d1 = data[i];
                                    if (i < data.length) {
                                        var d = x0 - d0.x > d1.x - x0 ? d1 : d0;
                                    } else {
                                        var d = d0;
                                    }

                                focus.attr("transform", "translate(" + x(d.x) + "," + y(d.y) + ")");
                                focus.select("text").text( d.y);
                              }
                            }
                        }
                    });

                    if (typeof data[0] === 'undefined') {
                        $("#notifybar")[0].innerText='no data yet'
                    };

                    socket.on('syncEventArray', function(sensordata) {
                            console.log('i didnt have anything in queue')
                            dataqueue=sensordata;
                            data = dataqueue.map(function(d) {
                                return {
                                    "x":parseDate(d.timestring), 
                                    "y":d.readvalue
                                }
                            });

                            data.sort(function(a, b) {
                                return a.x - b.x;
                            });

                            label_width = getLabelWidth(yAxis,svg, d3.min(data, function (d) { return d.y }), d3.max(data, function (d) { return d.y })); 
                    
                            if (layout.padData) {
                                // ADD ZERO VALUES WHERE THERE ARE GAPS IN THE DATA

                                // ASSUMES the data is sorted low to high
                                var date_range = d3.time.days(
                                    d3.time.minute.floor(data[0].x), 
                                new Date(+d3.time.minute.ceil(data[data.length - 1].x)+1), 1); // the +1 stops the last record being omitted
                                
                                if (date_range === undefined || date_range.length == 0) {
                                    console.info("Unable to interpret date range (" + d3.time.minute.floor(data[0].x)); }
                                else {
                                      var m = d3.map(data, function(d) {
                                      return d.x
                                    });
                                    var newData = date_range.map(function(bucket) {
                                      if (m.get(bucket)) {
                        //              console.info("passing over " + bucket);
                                        return m.get(bucket);
                                      } else {
                        //              console.info("creating value for " + bucket);
                                        return {
                                          x: bucket,
                                          y: 0
                                        };
                                      }
                                    });
                                    var numAdded = newData.length - data.length;
                                    console.info("Added " + numAdded + " rows of padding");
                                    data = newData;
                                    newData = null;
                                    }
                                }
                            if (typeof data[0] === 'undefined') {  
                                $("#notifybar")[0].innerText='no data yet'
                                // svg.append("text")
                                // .attr("id", "errortext")
                                // .attr("class", "error")
                                // .text("")
                                // .attr("text-anchor", "middle")
                                // .style("fill","#444")
                                // .attr("transform", "translate(" + width/2 + "," + height/2 + ")")
                            } else if (data[0].x == null) { // Either no data or error converting Date/Time, so display message and skip render
                                console.info(data.length + " items to plot");
                                if (data.length == 1) { console.info("single item: " + data[0].x + "," + data[0].y); }
                                if (data.length == 0) { // no data, so do nothing
                                } 
                                else {
                                    $("#notifybar")[0].innerText='Check the date/time format, could not parse date';
                                    }
                            }
                            else {  
                                $("#notifybar")[0].innerText='';
                                
                                margin.left = left_margin + label_width;
                                width = ext_width - (margin.left + margin.right );

                                d3.select("#" + id + "Transformer")
                                    .attr("width", width)
                                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                                x = d3.time.scale()
                                    .range([0, width]);

                                y = d3.scale.linear()
                                    .range([height, 0]);

                                y.domain([0, height]);

                                xAxis = d3.svg.axis()
                                    .scale(x)
                                    .orient("bottom");

                                yAxis = d3.svg.axis()
                                    .scale(y)
                                    .orient("left");    

                                x.domain(d3.extent(data, function(d) { return d.x; }));
                                y.domain(d3.extent(data, function(d) { return d.y; })); 

                                // DRAW FILL FIRST SO THAT AXES & LINE GO ON TOP
                                if(layout.showFill) {
                                    svg.append("path")
                                    .style("fill", "lightsteelblue")
                                    .attr("stroke-width", 0)
                                    .attr("class", "area")
                                    .attr("d", poly(data));
                                }
                                    
                                svg.append("g")
                                    .attr("class", "x axis")
                                    .attr("transform", "translate(0," + height + ")")
                                    .call(xAxis)
                                    .selectAll("text") 
                                    .attr("transform","translate(-8,0) rotate(-45)")
                                    .style("text-anchor","end");

                                svg.append("g")
                                    .attr("class", "y axis")
                                    .call(yAxis)
                                    .append("text")
                                    .attr("class", "axis-label")
                                    .attr('transform', 'translate(0, -17)')
                                    .attr('text-anchor','start')
                                    .attr("dy", ".71em")
                                    .style("font-weight", "bold")
                        //          .style("fill","#444")
                                    .text('Measure Value');
                                        
                                if (data.length>1) { // lines don't work with less than 2 points
                                    svg.append("path")
                                        .attr("stroke", "blue")
                                        .attr("stroke-width", 2)
                                        .attr("class", "line")
                                        .attr("d", line(data));
                                        //console.log('line(data):',line(data))
                                } 
                                else {
                                    svg.selectAll(".dot")
                                      .data(data)
                                      .enter().append("circle")
                                      .attr("class", "dot")
                                      .attr("r", 2)
                                      .attr("cx", function(d) { return x(d.x); })
                                      .attr("cy", function(d) { return y(d.y); })
                                      .style("fill", "blue")          ;
                                }
                                if (layout.showDataPoints) {
                                    svg.selectAll(".dot")
                                      .data(data)
                                      .enter().append("circle")
                                      .attr("class", "dot")
                                      .attr("r", 2)
                                      .attr("cx", function(d) { return x(d.x); })
                                      .attr("cy", function(d) { return y(d.y); })
                                      .style("fill", "steelblue")         ;
                                }

                                if (layout.showValuesOnMouseOver) {
                                // Display value when mouse hovers over chart 
                                    var focus = svg.append("g")
                                      .attr("class", "focus")
                                      .style("display", "none")
                                      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


                                  focus.append("circle")
                                      .attr("class","tooltip")
                                      .attr("r", 4.5)
                                      .style("fill", "none")
                                      .style("stroke", "#444")
                                      .style("stroke-width","1.5px");

                                  focus.append("text")
                                      .attr("class","tooltip")
                                      .attr("x", 9)
                                      .attr("dy", ".35em");
                                  svg.append("rect")
                                      .attr("class", "overlay")
                                      .attr("width", width )
                                      .attr("height", height)
                                      .attr("stroke","green")
                                      .attr("stroke-width","2")
                                      .style("opacity", "0")
                                      .on("mouseover", function() { focus.style("display", null); })
                                      .on("mouseout", function() { focus.style("display", "none"); })
                                      .on("mousemove", mousemove);

                                  bisectDate = d3.bisector(function(d) { return d.x; }).left
                                
                                  function mousemove() {
                                    var x0 = x.invert(d3.mouse(this)[0]),
                                        i = bisectDate(data, x0, 1)
                                        d0 = data[i - 1],
                                        d1 = data[i];
                                        if (i < data.length) {
                                            var d = x0 - d0.x > d1.x - x0 ? d1 : d0;
                                        } else {
                                            var d = d0;
                                        }
                                    focus.attr("transform", "translate(" + x(d.x) + "," + y(d.y) + ")");
                                    focus.select("text").text( d.y);
                                  }
                                }
                            }
                    });

                    if (err) {
                        console.log(err);
                    } else {
                    }
                });
                var id = senseUtils.setupContainer($element,layout,"d3vl_line"),
                    ext_width = $element.width()+40,
                    ext_height = $element.height();
                    
                var left_margin = 20,
                    margin = {top: 25, right: 20, bottom: 50, left: left_margin},
                    width = ext_width - (margin.left + margin.right),
                    height = ext_height - margin.top - margin.bottom;
                    
                var svg = d3.select("#" + id).append("svg")
                    .attr("width", ext_width )
                    .attr("height", ext_height )
                    .append("g")
                    .attr("id",id + "Transformer")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
                    
                var parseDate = d3.time.format(layout.dateformat).parse;

            },
            resize:function($el,layout){
                //this.paint($el,layout);
            }
    };
});

// Helper functions
function getLabelWidth(axis, svg, smallestValue, biggestValue) {
    // Create a temporary yAxis to get the width needed for labels and add to the margin
    svg.append("g")
        .attr("class", "y axis temp")
        .attr("transform", "translate(0," + 0 + ")")
        .call(axis)
        .append("text")
        .attr("class", "axis-label")
        .style("font-weight", "bold")
        .style("fill","#444")
        .text(smallestValue)
        .append("text")
        .attr("class", "axis-label")
        .style("font-weight", "bold")
        .style("fill","#444")
        .text(biggestValue)
        ;
    // Get the temp axis max label width
    var labelWidth = d3.max(svg.selectAll(".y.axis.temp text")[0], function(d) {
        return d.clientWidth ;
    });
    // Remove the temp axis
    svg.selectAll(".y.axis.temp").remove();
    return labelWidth ;
}
        
function type(d) {
  d.date = formatDate.parse(d.date);
  d.close = +d.close;
  return d;
}

function sortByTime(a, b) {
    if (a[x] === b[x]) {
        return 0;
    }
    else {
        console.info("SORTING");
        return (a[x] < b[x]) ? -1 : 1;
    }
}