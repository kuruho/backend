# Backend

This application is written in node.js and it acts as a proxy/controller between a Volumio device and a dedicated Android app.

# Prerequisites

* Node.js v.6.1.0+
* A device running [volumio2](https://github.com/volumio/Volumio2/)
* A websocket client

# How it works

It performs the following tasks:

At startup:
  * Connects to Volumio and starts polling for its state (polling rate configurable via parameter)
    * It creates 2 Playlists:
      * one which contains a Pool of songs to be played
      * one which contains Played songs (or current)
  * Opens a listening websocket on a configurable port to expose few endpoints for the Android application
    * app::poll is sent in broadcast or to newly connected clients
      * ```[{"service":"mpd","type":"song","title":"I Can Dream","artist":"Skunk Anansie","album":"Paranoid & Sunburnt","albumart":"/albumart?web=Skunk%20Anansie/Paranoid%20%26%20Sunburnt/extralarge","uri":"mnt/INTERNAL/03. skunk anansie - i can dream.mp3","color":"#1557FE"},{"service":"mpd","type":"song","title":"Iron Man","artist":"Black Sabbath","album":"Paranoid","albumart":"/albumart?web=Black%20Sabbath/Paranoid/extralarge","uri":"mnt/INTERNAL/Black Sabbath - Iron Man.mp3","color":"#B808FE"},{"service":"mpd","type":"song","title":"Born to Be Wild","artist":"Steppenwolf","albumart":"/albumart?web=Steppenwolf//extralarge","uri":"mnt/INTERNAL/Steppenwolf - Born to Be Wild.mp3","color":"#CEFF00"}]```
      * Important fields per object in array: title, artis, uri, color
    * app::vote must be sent from client with a json parameter
      * ```{"userid": "<the uuid of the user>", "uri": "uri of the song to be played"}```
    * app::result is sent in broadcast or to newly connected clients
      * ```{"service":"mpd","type":"song","title":"I Can Dream","artist":"Skunk Anansie","album":"Paranoid & Sunburnt","albumart":"/albumart?web=Skunk%20Anansie/Paranoid%20%26%20Sunburnt/extralarge","uri":"mnt/INTERNAL/03. skunk anansie - i can dream.mp3","color":"#1557FE"}```

