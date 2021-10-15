 /*
  * My YouTube mp3 downloader.
  * Built on ytdl-core and ffmpeg.
  */

'use strict';

// Modules
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const EventEmitter = require('events');
const {delFile, doUpdate, startProgress, logStr} = require('./js/helper');
const {checkURL, fetchMp4} = require('./js/ytdl');

// Set some variables
dotenv.config();
const port = process.env.PORT || 3000;
const dir = path.join(__dirname, 'public');
let mp3Emitter = new EventEmitter;
let mp4Emitter = new EventEmitter;

// MongoDB stuff
const {MongoClient} = require('mongodb');
const uri = process.env.SECRET;
const client = new MongoClient(uri, 
  {useNewUrlParser: true, useUnifiedTopology: true}
);
const db = client.db('ytdl');
const coll = (port === 3000) ? 'downloads': 'onlineDownloads';
client.connect((err) => {
  if (err) { 
    console.log('MongoDB failed to connect.');
  }
});

// Start the server.
const app = express();
app.listen(port, () => {
  console.log(`Server listening on port ${port}.`);
});

// Middleware
app.use(express.static(dir));
app.use(express.json());

// Routes
// Try to get the video id and title and send to client.
app.get('/video/', (req, res) => {
  checkURL(res, req.query.url);
});

// Route for mp4 progress bar.
app.get('/:id/mp4Event/', async (req, res) => {
  function mp4Update(data) {
    doUpdate(res, data, req.params.id, mp4Emitter, mp4Update);
  };
  startProgress(res, req.params.id, mp4Emitter, mp4Update); 
});

// Route for mp3 progress bar.
app.get('/:id/mp3Event', async (req, res) => {
  function mp3Update(data) {
    doUpdate(res, data, req.params.id, mp3Emitter, mp3Update);
  };
  startProgress(res, req.params.id, mp3Emitter, mp3Update);
});

// This route starts the stream, extracts mp3 and adds the tags.
app.post('/mp3', (req, res) => {
  fetchMp4(req.body.obj, mp4Emitter, mp3Emitter);
  res.json({obj: req.body.obj});
});

// Route to provide download.
app.post('/download', function(req, res) {
  const obj = req.body.obj;
  res.download(obj.audioFile);
  // Update the database.
  db.collection(coll).insertOne({text: logStr(obj.artist, obj.title)}, (err) => {
    if (err) {
      console.log(err);
    }
  });
  // Clean up files.
  setTimeout(function() {
    delFile(path.join(__dirname, 'public', obj.thumb));
    delFile(path.join(__dirname, obj.audioFile));
    delFile(path.join(__dirname, obj.videoFile));
  }, 1000);
});

// Route for the log feature.
app.post('/log', function(req, res) {
  db.collection('users').findOne({name: req.body.user}, function(err, result) {
    if (err) {
      throw err;
    } else {
      if (!result) {
        return res.status(401).send({error: 'User not found.'});
      }
      if (req.body.password !== result.password) {
        return res.status(401).send({error: 'Incorrect password.'});
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


