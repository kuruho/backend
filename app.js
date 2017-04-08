/*jshint node:true*/
// Config based on NODE_ENV https://goenning.net/2016/05/13/how-i-manage-application-configuration-with-nodejs/
var config = require('./config');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var ioclient = require('socket.io-client');

// HTTP ENDPOINTS

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

// WS ENDPOINTS

io.on('connection', function (socket) {

    io.emit('this', { will: 'be received by everyone'});

    socket.on('state', function (from, msg) {
        console.log('I received a private message by ', from, ' saying ', msg);
    });

    socket.on('disconnect', function () {
        io.emit('user disconnected');
    });
});

// VOLUMIO

var volumio = ioclient.connect(config.volumio.ws);

// On connection to Volumio
volumio.on('connect', function(){
    console.log("connect");

    // Request state periodically
    var volumio_state_timeout = setInterval(function() {
        volumio.emit('getState', '');
    }, config.volumio.status_interval_ms);

    // Volumio state retrieved
    volumio.on('pushState',function(data)
    {
        console.log(data);
        if (data.status === 'play') {
            currentSong = data.uri;
            timeToEnd = data.duration - (data.seek/1000.0);
            console.log(currentSong);
            console.log(timeToEnd);
        }
    });

    // Stop polling Volumio
    volumio.on('disconnect', function(){

        clearInterval(volumio_state_timeout);

        console.log("disconnect");
    });

});

// Listen
http.listen(config.server.port, function(){
    console.log('Server listening on port ' + config.server.port);
});