module.exports = {
    server: {
        port: 7001,
        songs_per_poll: 5,
        colors: ['#1557FE','#B808FE','#CEFF00','#00FEE3','#F1C800','#F1C800','#F11200','#2800A6']
    },
    volumio: {
        status_interval_ms: 2000,
        pool_playlist_name: 'Pool',
        played_playlist_name: 'Played',
        remaining_time_to_terminate_s: 10
    },
    log: "info"
};