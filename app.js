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

    this.expired = false;

    // Object having as properties userids and as values the uri of the song voted
    this.votes = {};

    // Array of objects which represent songs
    this.songs = undefined;

    // Array of objects which represent songs choosen for the current poll
    this.songs_in_poll = undefined;

    this.current_song_uri = undefined;

    // Register a vote, being a vote an object with userid and uri
    this.registerVote = function(vote)
    {
        this.votes[vote.userid] = vote.uri
        console.log(this.votes);
    }

    // Set the list of songs available
    this.setSongs = function(songs)
    {
        this.songs = songs;
        if (this.songs_in_poll == undefined)
        {
            this.generatePoll();
        }
    }

    this.setCurrentSongUri = function(songUri)
    {
        if (this.current_song_uri != songUri)
        {
            this.current_song_uri = songUri;
            this.expired = false;
            console.log('We can start the countdown!');
        }
    }

    // Generate the results of a poll
    this.generateResults = function()
    {
        if (!this.expired) {
            this.expired = true;

            // Compute results
            var final_results = _.reduce(this.votes, function (result, key, value) {
                result[key] = (result[key] || 0) + 1;
                return result;
            }, {});
            console.log('Final results: ' + final_results);
            var winning_song_uri = _.maxBy(_.toPairs(final_results), function (o) {
                return o[1];
            });
            console.log('Winning song uri: ' + winning_song_uri);

            // Clear votes
            this.votes = {};

            // Set results, enrich with meta
            if (winning_song_uri == undefined && !_.isEmpty(this.songs_in_poll)) {
                // Pick a random one, no one voted
                this.results = this.songs_in_poll[0];
                winning_song_uri = this.results.uri;
                console.log('Picking a random winner since no one voted');
            }
            else
            {
                // Pick the winning song
                this.results = _.find(this.songs_in_poll, function(o) { return o.uri == winning_song_uri });
            }
            console.log('We have a winner: ' + JSON.stringify(this.results));

            // Enqueue uri to played and remove from pool
            volumio.emit('addToPlaylist', {name: config.volumio.played_playlist_name, uri: winning_song_uri});
            volumio.emit('removeFromPlaylist', {name: config.volumio.pool_playlist_name, uri: winning_song_uri});

            // Send results
            this.sendResult();
        }
    }

    // Send the results to all clients
    this.sendResult = function()
    {
        io.emit('app::result', this.results);
    }

    // Generate a new poll
    this.generatePoll = function ()
    {
        // Pick random n songs
        var songs_in_poll = _.shuffle(this.songs).slice(0, config.server.songs_per_poll);
        console.log('Selected songs in current poll: ' + JSON.stringify(songs_in_poll));
        var index = 0;
        // Assign a color to each song
        this.songs_in_poll = _.forEach(songs_in_poll, function(o) { return o['color'] = config.server.colors[index++]; });

        // Send songs to everyone
        this.sendCurrentPoll();

    }

    // Send the poll to all clients
    this.sendCurrentPoll = function()
    {
        if (this.songs_in_poll != undefined)
        {
            io.emit('app:poll', this.songs_in_poll);
        }
    }
}

var poll = new Poll();

// HTTP ENDPOINTS

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

// WS ENDPOINTS

io.on('connection', function (socket) {

    poll.sendCurrentPoll(socket);

    socket.on('app:vote', function(vote) {
        console.log('Received vote: ' + vote);
        poll.registerVote(vote);
    });

    socket.on('disconnect', function () {
        io.emit('User disconnected');
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
        var navigationList = data.navigation.lists[0];
        var songs = _.filter(navigationList.items, function(o) { return o.type == 'song'});
        if (!_.isEmpty(songs))
        {
            poll.setSongs(songs);
            console.log(songs);
        }

    });

    // Get library content
    volumio.emit('browseLibrary', {uri: "playlists/" + config.volumio.pool_playlist_name}); //, prevUri: "playlists"

    // Volumio state retrieved
    volumio.on('pushState',function(data)
    {
        if (data.status === 'play') {
            currentSongUri = data.uri;
            timeToEnd = data.duration - (data.seek/1000.0);
            console.log(currentSongUri);
            console.log(timeToEnd);
            poll.setCurrentSongUri(currentSongUri);
            if (timeToEnd < config.volumio.remaining_time_to_terminate_s) {
                poll.generateResults();
            }
            //             volumio.emit('playPlaylist', {name:config.volumio.played_playlist_name});
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