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

    // Uri of the current song
    this.current_song_uri = undefined;
    this.current_song_seek = undefined;

    this.results = undefined;

    // Register a vote, being a vote an object with userid and uri
    this.registerVote = function(vote)
    {
        this.votes[vote.userid] = vote.uri;
        console.log("Got vote for: " + JSON.stringify(vote));
    }

    this.refreshSongs = function()
    {
        // Get library content
        volumio.emit('browseLibrary', {uri: "playlists/" + config.volumio.pool_playlist_name}); //, prevUri: "playlists"
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

    this.setCurrentSongUri = function(songUri, seek)
    {
        if (this.current_song_uri != songUri || this.current_song_seek > seek)
        {
            this.current_song_uri = songUri;
            this.current_song_seek = seek;
            // Reset the status of the poll
            this.expired = false;
        }

        // This is necessary for the first attempt, when we have no winners
        if (this.results == undefined && songUri != undefined)
        {
            this.results = _.find(this.songs, function(o) { return o.uri == songUri; });
            this.results.color = config.server.colors[0];
            this.sendResult();
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
            console.log('Final results: ' + JSON.stringify(final_results));
            var winning_song_uri = _.maxBy(_.toPairs(final_results), function (o) {
                return o[1];
            });

            // Clear votes
            this.votes = {};

            console.log('Winning song uri: ' + winning_song_uri);

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
                this.results = _.find(this.songs_in_poll, function(o) { return o.uri == winning_song_uri[0]; });
            }
            console.log('We have a winner: ' + JSON.stringify(this.results));

            // Enqueue uri to played and remove from pool
            volumio.emit('addToQueue',{uri:this.results.uri, title:this.results.title, service:this.results.service});
            volumio.emit('removeFromPlaylist', {name: config.volumio.pool_playlist_name, uri: this.results.uri, service: this.results.service});
            volumio.emit('addToPlaylist', {name: config.volumio.played_playlist_name, uri: this.results.uri, service: this.results.service});

            this.refreshSongs();

            // Send results
            this.sendResult();

            // Generate a new poll
            this.generatePoll();
        }
    }

    // Send the results to all clients
    this.sendResult = function(sock)
    {
        if (sock == undefined)
        {
            // To all
            io.emit('app:state', { data: this.results });
        }
        else
        {
            // To single user
            sock.emit('app:state', { data: this.results });
        }
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
    this.sendCurrentPoll = function(sock)
    {
        if (this.songs_in_poll != undefined)
        {
            if (sock == undefined)
            {
                // To all
                io.emit('app:songlist', { data: this.songs_in_poll});
            }
            else
            {
                // To single user
                sock.emit('app:songlist', { data: this.songs_in_poll});
            }
        }
    }
}

var poll = new Poll();

var init = true;

// HTTP ENDPOINTS

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

// WS ENDPOINTS

io.on('connection', function (socket) {

    socket.on('app:ready', function() {
        console.log('One app is ready!');
        poll.sendCurrentPoll(socket);
        poll.sendResult(socket);
    });

    socket.on('app:vote', function(vote) {
        console.log('Received vote: ' + vote);
        poll.registerVote(vote);
    });

    socket.on('disconnect', function () {
        console.log('One app disconnected!');
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


    volumio.on('pushBrowseLibrary', function(data) {
        console.log('BrowseList returned: ' + JSON.stringify(data));
        console.log(JSON.stringify('Songs in poll: ' + JSON.stringify(poll.songs_in_poll)));
        // Extract songs from our playlist and update the pool
        //"navigation":{"lists":[{"availableListViews":["list"],"items":[{"service":"mpd","type":"song"...
        var navigationList = data.navigation.lists[0];
        var songs = _.filter(navigationList.items, function(o) { return o.type == 'song' });
        if (!_.isEmpty(songs))
        {
            poll.setSongs(songs);
            if (poll.expired || poll.results == undefined) {
                poll.generatePoll();
            }
        }

    });

    // This should allow to support songs to be added dynamically to the Pool playlist, but
    // given the fact pushBrowseLibrary has no playlist name, it is
    // dangerous to use it, because any change on another playlist could overwrite my songs in our playlist of interest
    // volumio.on('pushAddToPlaylist', function(data) {
    //     poll.refreshSongs();
    // });

    // Prepare a pool of songs and an empty played songs
    if(init) {
        volumio.emit('createPlaylist', {name: config.volumio.pool_playlist_name});
        volumio.emit('createPlaylist', {name:config.volumio.played_playlist_name});
        poll.refreshSongs();
        init = false;
    }

    // Volumio state retrieved
    volumio.on('pushState',function(data)
    {
        poll.setCurrentSongUri(data.uri, data.seek);
        if (data.status === 'play') {
            timeToEnd = data.duration - (data.seek/1000.0);
            console.log('Current song uri: ' + poll.current_song_uri);
            console.log('Time to end: ' + timeToEnd);
            console.log('Complete song list: ' + JSON.stringify(poll.songs));
            console.log('Current songs in poll: ' + JSON.stringify(poll.songs_in_poll));
            console.log('Last winning song: ' + JSON.stringify(poll.results));
            if (!poll.expired && timeToEnd < config.volumio.remaining_time_to_terminate_s) {
                poll.generateResults();
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