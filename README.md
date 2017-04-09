# Backend

This application is written in node.js and it acts as a proxy/controller between a Volumio device and a dedicated Android app.

## Prerequisites

* Node.js v.6.1.0+
* A device running [volumio2](https://github.com/volumio/Volumio2/)
* A websocket client

## How it works

It performs the following tasks:

At startup:
  * Connects to Volumio and starts polling for its state (polling interval configurable via ```config.volumio.status_interval_ms```)
    * It creates 2 Playlists:
      * one which contains a Pool of songs to be played (name configurable via ```config.volumio.pool_playlist_name```)
      * one which contains Played songs (or current) (name configurable via ```config.volumio.played_playlist_name```)
  * Opens a listening websocket on a configurable port to expose few endpoints for the Android application
    * ```app:songlist``` is the list of the available song to be voted. It is sent in broadcast or under explicit request by client via ```app:ready```
      * ```{ "data":[ {"service":"mpd","type":"song","title":"I Can Dream","artist":"Skunk Anansie","album":"Paranoid & Sunburnt","albumart":"/albumart?web=Skunk%20Anansie/Paranoid%20%26%20Sunburnt/extralarge","uri":"mnt/INTERNAL/03. skunk anansie - i can dream.mp3","color":"#1557FE"},{"service":"mpd","type":"song","title":"Iron Man","artist":"Black Sabbath","album":"Paranoid","albumart":"/albumart?web=Black%20Sabbath/Paranoid/extralarge","uri":"mnt/INTERNAL/Black Sabbath - Iron Man.mp3","color":"#B808FE"},{"service":"mpd","type":"song","title":"Born to Be Wild","artist":"Steppenwolf","albumart":"/albumart?web=Steppenwolf//extralarge","uri":"mnt/INTERNAL/Steppenwolf - Born to Be Wild.mp3","color":"#CEFF00"}]}```
      * Important fields per object in array: title, artis, uri, color
      * Its size is configurable via ```config.server.songs_per_poll```
      * The color palette is selected from a configurable color array ```config.server.colors```; make sure its length is equal or greater than the size of the poll
    * ```app:vote``` is the endpoint to vote for a song. It must be sent from client with a json parameter as the following
      * ```{"userid": "<the uuid of the user>", "uri": "uri of the song to be played"}```
      * Multiple votes are accepted but it will be considered only once
    * ```app:status``` is the song which has won. It is sent in broadcast or under explicit request by client via ```app:ready```
      * ```{ "data": {"service":"mpd","type":"song","title":"I Can Dream","artist":"Skunk Anansie","album":"Paranoid & Sunburnt","albumart":"/albumart?web=Skunk%20Anansie/Paranoid%20%26%20Sunburnt/extralarge","uri":"mnt/INTERNAL/03. skunk anansie - i can dream.mp3","color":"#1557FE"}}```

## How to setup the environment

You can just run the following command

```
./envsetup.sh
```

  * It installs nvm (a tool to let multiple nodejs versions to co-exist
  * It installs Node.js v.6.1.0
  * It installs the project dependencies from the package.json file

## How to run

You can run the following command

```
NODE_ENV=<yourenv> node app.js
```

If ```NODE_ENV``` is not specified, development will be taken into account.
Ensure the environment is present under the ```config``` folder. Defaults are in ```default.js```.

## Volumio setup

  * Create the ```Pool``` playlist
  * Place all the songs in ```Pool```
  * Clear the playing queue
  * Play any song via direct play
  * Enjoy
