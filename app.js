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
dotenv.config();

// Set some variables
const port = process.env.PORT || 3000;
const dir = path.join(__dirname, 'public');
ffmpeg.setFfmpegPath(ffmpegPath);

// MongoDB stuff
const {MongoClient} = require('mongodb');
const uri = process.env.SECRET;
const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true});
const db = client.db('ytdl');

/** Logging function */
function updateLog(artist, track) {
  const dateOb = new Date();
  const date = ('0' + dateOb.getDate()).slice(-2);
  const month = ('0' + (dateOb.getMonth() + 1)).slice(-2);
  const year = dateOb.getFullYear();
  const hours = ('0' + dateOb.getHours()).slice(-2);
  const minutes = ('0' + dateOb.getMinutes()).slice(-2);
  const seconds = ('0' + dateOb.getSeconds()).slice(-2);
  const dateStr = `${date}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  const msg = dateStr + ' ' + artist + ': ' + track;
  db.collection('downloads').insertOne({text: msg}, (err) => {
    if (err) {
      console.log(err);
    }
  });
}

// Start the server.
const app = express();
app.listen(port, () => {
  console.log(`Server listening on port ${port}.`);
});

// Connect to the database
client.connect((err) => {
  if (err) return console.log(err);
});

// Middleware
app.use(express.static(dir));
app.use(express.json());

// Routes
app.post('/video', (req, res) => {
  // Try to get the video id and title and send to client.
  let id;
  const url = req.body.url;
  // Check the URL first.
  try {
    id = ytdl.getURLVideoID(url);

    // Get the thumbnail into a buffer. Crop & save it.
    const thumb = path.join(__dirname, 'public', id + '.jpg');
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
          // Send the id, title and url to the client.
          res.json({id: id, title: title, url: url, author: author});
        })
        .catch((err) => {
          res.json({msg: -1});
        });
  } catch (error) {
    res.json({msg: -1});
  }
});

app.post('/mp3', (req, res) => {
  // This route start the stream, extracts mp3 and adds the tags.
  const id = req.body.id;
  const url = req.body.url;
  const track = req.body.title;
  const artist = req.body.artist;

  const filepath = path.join(__dirname, id + '.mp3');
  const thumb = path.join(__dirname, 'public', id + '.jpg');
  const stream = ytdl(url, {highWaterMark: 1<<22, quality: 'highestaudio'});
  const writeStream = fs.createWriteStream(filepath, {highWaterMark: 1<<22});
  const meta = {
    title: track,
    artist: artist,
    APIC: thumb,
  };
  ffmpeg(stream)
      .audioCodec('libmp3lame')
      .format('mp3')
      .audioQuality(3)
      .on('error', function(err) {
        console.log('Ffmpeg error: ' + err.message);
        res.json({msg: -1});
      })
      .on('end', () => {
        updateLog(artist, track);
        const tagsWritten = id3.write(meta, filepath);
        res.json({track: track, id: id});
      })
      .pipe(writeStream, {end: true});
});

app.get('/download/:id', function(req, res) {
  // Route to provide download.
  const id = req.params.id;
  const thumbName = id.slice(0, id.indexOf('.mp3')) + '.jpg';
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

app.get('/log', function(req, res) {
  // console.log(req.query);
  if (req.query.name !== 'mark') {
    return res.send('You are not authorised to see this page.');
  }

  db.collection('downloads').find().toArray((err, docs) => {
    if (err) {
      console.log(err);
    } else {
      const msg = docs.map((elem) => elem.text).join('\n');
      res.end(msg);
    }
  });
});

app.all('*', function(req, res) {
  res.status(404).send('Page not found.');
});
