// My youtube downloader

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
const logStr = require('./logStr');
dotenv.config();

// Set some variables
const port = process.env.PORT || 3000;
const pword = process.env.AUTH;
const dir = path.join(__dirname, 'public');
ffmpeg.setFfmpegPath(ffmpegPath);

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

// Routes
app.post('/video', (req, res) => {
  // Try to get the video id and title and send to client.
  const url = req.body.url;
  // Check the URL first.
  try {
    const id = ytdl.getURLVideoID(url);
    // Get the thumbnail into a buffer. Crop & save it.
    const thumb = path.join(__dirname, 'public', `${id}.jpg`);
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
          // Send video information to the client.
          res.json({id: id, title: title, url: url, author: author});
        })
        .catch((err) => {
          res.status(400).end();
        });
  } catch (error) {
    res.status(400).end();
  }
});

app.post('/mp3', (req, res) => {
  // This route start the stream, extracts mp3 and adds the tags.
  const id = req.body.id;
  const url = req.body.url;
  const track = req.body.title;
  const artist = req.body.artist;
  const filepath = path.join(__dirname, `${id}.mp3`);
  const thumb = path.join(__dirname, 'public', `${id}.jpg`);
  const stream = ytdl(url, {highWaterMark: 1<<22, quality: 'highestaudio'});
  const writeStream = fs.createWriteStream(filepath, {highWaterMark: 1<<22});
  const meta = { title: track, artist: artist, APIC: thumb };
  ffmpeg(stream)
      .audioCodec('libmp3lame')
      .format('mp3')
      .audioQuality(3)
      .on('error', function(err) {
        console.log(`Ffmpeg error: ${err.message}`);
          res.status(400).end();
      })
      .on('end', () => {
        const log = logStr(artist, track);
        db.collection(coll).insertOne({text: log}, (err) => {
          if (err) {
            console.log(err);
          }
        });
        const tagsWritten = id3.write(meta, filepath);
        res.json({track: track, id: id});
      })
      .pipe(writeStream, {end: true});
});

app.get('/download/:id', function(req, res) {
  // Route to provide download.
  const id = req.params.id;
  const thumbName = `${id.slice(0, id.indexOf('.mp3'))}.jpg`;
  const thumb = path.join(__dirname, 'public', thumbName);
  const file = path.join(__dirname, id);
  res.download(file);
  // Clean up files.
  setTimeout(function() {
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

app.post('/log', function(req, res) {
  // Change this so that we look in the database first.
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
          const msg = docs.map((elem) => elem.text).join('<br />');
          res.json({log: msg});
        }
      });
    }
  });
});

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
