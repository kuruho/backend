/*jshint node:true*/
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var PORT = 3000;
var VOLUMIO_WS = '192.168.1.83';
var VOLUMIO_STATUS_INTERVAL = 2*1000;
var volumio = require('socket.io-client')('ws://' + VOLUMIO_WS);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

function getVolumioState() {
    volumio.emit('getState', '');
}

var volumio_state_timeout = null;

volumio.on('connect', function(){
    console.log("connect");

    volumio_state_timeout = setInterval(getVolumioState, VOLUMIO_STATUS_INTERVAL);

});

volumio.on('pushState',function(data)
{
    console.log(data);
});

volumio.on('disconnect', function(){

    clearInterval(volumio_state_timeout);

    console.log("disconnect");
});

http.listen(PORT, function(){
    console.log('Express server listening on port ' + PORT);
});