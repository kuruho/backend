module.exports = {
    server: {
        port: 7001,
        songs_per_poll: 5,
        colors: ['yellow','red','blue','pink','orange','black','white','purple']
    },
    volumio: {
        status_interval_ms: 2000,
        pool_playlist_name: 'Pool',
        played_playlist_name: 'Played',
        remaining_time_to_terminate_s: 10
    },
    log: "info"
};