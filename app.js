// My youtube downloader

"use strict";

// Modules
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const express = require('express');
const ytdl = require('ytdl-core');
const path = require('path');
const fs = require('fs');
const id3 = require('node-id3');
const request = require('request');
const sizeOf = require('image-size');
const gm = require('gm');
const dotenv = require('dotenv');
const logStr = require('./js/logStr');
const randID = require('./js/id');
const EventEmitter = require('events');

// Set some variables
dotenv.config();
const port = process.env.PORT || 3000;
const dir = path.join(__dirname, 'public');
ffmpeg.setFfmpegPath(ffmpegPath);
var mp3Emitter;
var videoEmitter;

// MongoDB stuff
const {MongoClient} = require('mongodb');
const uri = process.env.SECRET;
const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});
const db = client.db('ytdl');
var coll;
if (port === 3000) {
  coll = 'downloads';
} else {
  coll = 'onlineDownloads';
}

// Start the server.
const app = express();
app.listen(port, () => {
  console.log(`Server listening on port ${port}.`);
});

// Connect to the database
client.connect((err) => {
  if (err) { 
    console.log('MongoDB failed to connect.');
  }
});

// Middleware
app.use(express.static(dir));
app.use(express.json());

/** Turns the time-stamps into seconds as a number. */
function timeToSecs (time) {
  let h = Number(time.slice(0,2));
  let m = Number(time.slice(3,5));
  let s = Number(time.slice(6));
  s  += m * 60 + h * 360;
  return s;
};

// Routes
app.post('/video', (req, res) => {
  // Try to get the video id and title and send to client.
  const url = req.body.url;
  // Check the URL first.
  try {
    const id = ytdl.getURLVideoID(url);
    const uniqueId = id + randID(3);
    // Get the thumbnail into a buffer. Crop & save it.
    const thumb = path.join(__dirname, 'public', `${uniqueId}.jpg`);
    const thumbURL = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    request({url: thumbURL, method: 'get', encoding: null}, (err, resp, buffer) => {
      const dims = sizeOf(buffer);
      const newLen = dims.height * 0.75;
      gm(buffer)
        .gravity('Center')
        .crop(newLen, newLen)
        .write(thumb, (err) => {
          if (err) {
            console.log(err);
          }
        });
    });
    // Get the title of the video
    ytdl
      .getInfo(id)
      .then((info) => {
        const title = info.videoDetails.title;
        const author = info.videoDetails.author.name;
        const length = info.videoDetails.lengthSeconds;
        // Send video information to the client.
        res.json({id: uniqueId, title: title, url: url, author: author, length: length});
      })
      .catch((err) => {
        res.status(400).end();
      });
  } catch (error) {
    res.status(400).end();
  }
});

// Route for mp4 progress bar.
app.get('/:id/mp4Event/', async (req, res) => {
  videoEmitter = new EventEmitter;
  var id = req.params.id;

  /** Function to send progress data (mp4). */
  function mp4Update(data) {
    const percent = JSON.stringify(data);
    res.write(`event: progress${id}\n`);
    res.write('data: ' + percent);
    res.write('\n\n');
    if (data == 100) {
      res.end();
      videoEmitter.removeListener(`event${id}`, mp4Update);
    };
  };
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  videoEmitter.on(`event${id}`, mp4Update); 
});


// Route for mp3 progress bar.
app.get('/:id/mp3Event', async (req, res) => {
  mp3Emitter = new EventEmitter;
  var id = req.params.id;

  /** Function to send progress data (mp3). */
  function mp3Update(data) {
    const percent = JSON.stringify(data);
    res.write(`event: progress${id}\n`);
    res.write('data: ' + percent);
    res.write('\n\n');
    if (data == 100) {
      res.end();
      mp3Emitter.removeListener(`event${id}`, mp3Update);
    };
  };
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  mp3Emitter.on(`event${id}`, mp3Update);
});


// This route starts the stream, extracts mp3 and adds the tags.
app.post('/mp3', (req, res) => {
  const id = req.body.id;
  const url = req.body.url;
  const track = req.body.title;
  const length = req.body.length;
  const artist = req.body.artist;
  const videoPath = path.join(__dirname, `${id}.mp4`);
  const audioPath = path.join(__dirname, `${id}.mp3`);
  const thumb = path.join(__dirname, 'public', `${id}.jpg`);
  var startTime;
  var dur;
  const start = () => {
    const video = ytdl(url, {quality: 'highestaudio'});
    video.pipe(fs.createWriteStream(videoPath));

    video.once('response', () => {
      startTime = Date.now();
    });

    // Check if it is slow connection. Restart stream if so.
    video.on('progress', (chunkLength, downloaded, total) => {
      var percent = downloaded / total;
      const downloadedMins = (Date.now() - startTime) / 1000 / 60;
      var estimate = Math.ceil(downloadedMins / percent - downloadedMins);
      if (estimate == 0) {
        estimate = 1;
      }
      if ((length / estimate) >= 600) { 
        console.log("Slow connection.");
        video.destroy();
        start();
      }
      videoEmitter.emit(`event${id}`, Math.floor(percent * 100));
    });

    video.on('end', () => {
      const writeStream = fs.createWriteStream(audioPath);
      const meta = { title: track, artist: artist, album: "YouTube", APIC: thumb };
      ffmpeg(videoPath, {niceness: "10"})
        .audioCodec('libmp3lame')
        .format('mp3')
        .audioQuality(3)
        .on('error', function(err) {
          console.log(`Ffmpeg error: ${err.message}`);
          res.status(400).end();
        })
        .on('codecData' , function(data) {
          dur = timeToSecs(data.duration);
        })
        .on('progress', function(progress) {
          let time = timeToSecs(progress.timemark);
          let percent = Math.floor((time / dur) * 100);
          mp3Emitter.emit(`event${id}`, percent);
        })
        .on('end', () => {
          const log = logStr(artist, track);
          db.collection(coll).insertOne({text: log}, (err) => {
            if (err) {
              console.log(err);
            }
          });
          const tagsWritten = id3.write(meta, audioPath);
          res.json({track: track, id: id});
        })
        .pipe(writeStream, {end: true});
    });
  };
  start();
});

// Route to provide download.
app.get('/download/:id', function(req, res) {
  const id = req.params.id;
  const vidName = `${id.slice(0, id.indexOf('.mp3'))}.mp4`;
  const thumbName = `${id.slice(0, id.indexOf('.mp3'))}.jpg`;
  const thumb = path.join(__dirname, 'public', thumbName);
  const file = path.join(__dirname, id);
  const video = path.join(__dirname, vidName);
  res.download(file);
  // Clean up files.
  setTimeout(function() {
    fs.unlink(video, function(err) {
      if (err) {
        console.log('Error deleting file.');
      }
    });
    fs.unlink(file, function(err) {
      if (err) {
        console.log('Error deleting file.');
      }
    });
    fs.unlink(thumb, function(err) {
      if (err) {
        console.log('Error deleting file.');
      }
    });
  }, 1000);
});

// Route for the log feature.
app.post('/log', function(req, res) {
  db.collection("users").findOne({name: req.body.user}, function(err, result) {
    if (err) {
      throw err;
    } else {
      if (!result) {
        return res.status(401).send({error: "User not found."});
      }
      if (req.body.password !== result.password) {
        return res.status(401).send({error: "Incorrect password."});
      }
      db.collection(coll).find().toArray((err, docs) => {
        if (err) {
          console.log(err);
        } else {
          const msg = docs.reverse().map((elem) => elem.text).join('<br />');
          res.json({log: msg});
        }
      });
    }
  });
});

// Anything else.
app.all('*', function(req, res) {
  res.status(404).send('Page not found.');
});


// Dummy function at the moment, need to check if user exists etc.
function addUser(newUser, newPwd) {
  db.collection("users").insertOne({name: newUser, password: newPwd}, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Wrote user & password.");
    }
  });
}
