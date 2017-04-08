/*jshint node:true*/

// Config based on NODE_ENV https://goenning.net/2016/05/13/how-i-manage-application-configuration-with-nodejs/
var config = require('./config');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var ioclient = require('socket.io-client');
var _ = require('lodash');
var EventEmitter = require('events')

// BUSINESS

function Poll() {
    events.EventEmitter.call(this);

    this.terminate = function()
    {
        this.emit('terminate');
    }
}

Poll.prototype.__proto__ = events.EventEmitter.prototype;

var poll = new Poll();

poll.on('terminate', function() {
    
});


var songs_pool = {};

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

    var songs = undefined;

    // Prepare a pool of songs and an empty played songs
    volumio.emit('createPlaylist', {name: config.volumio.pool_playlist_name});
    volumio.emit('deletePlaylist', {name: config.volumio.played_playlist_name});
    volumio.on('pushBrowseLibrary', function(data) {
        volumio.emit('createPlaylist', {name:config.volumio.played_playlist_name});

        // Extract songs from our playlist and update the pool
        //"navigation":{"lists":[{"availableListViews":["list"],"items":[{"service":"mpd","type":"song"...
        var navigationList = data.navigation.lists[0]
        var songs = _.filter(navigationList.items, function(o) { return o.type == 'song'});
        if (!_.isEmpty(songs))
        {
            songs_pool = songs;
            console.log(songs_pool);
        }

    });

    // Get library content
    volumio.emit('browseLibrary', {uri: "playlists/" + config.volumio.pool_playlist_name}); //, prevUri: "playlists"

    // Volumio state retrieved
    volumio.on('pushState',function(data)
    {
        console.log(data);
        if (data.status === 'play') {
            currentSong = data.uri;
            timeToEnd = data.duration - (data.seek/1000.0);
            console.log(currentSong);
            console.log(timeToEnd);
            // FIXME ONLY ONCE
            if (timeToEnd < config.volumio.remaining_time_to_terminate_s) {
                poll.terminate();
            }
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