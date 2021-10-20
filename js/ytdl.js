'use strict';

const fs = require('fs');
const request = require('request');
const sizeOf = require('image-size');
const gm = require('gm');
const path = require('path');
const convertMp3 = require('../js/ffmpeg');
const ytdl = require('ytdl-core');

/** Use ytdl-core to check the URL and get info. */
function checkURL(res, url) {
  try {
    let obj = {url: url};
    const id = ytdl.getURLVideoID(obj.url);
    obj.id = id + randID(3);
    obj.videoFile = `${obj.id}.mp4`;
    obj.audioFile = `${obj.id}.mp3`; 
    // Get the thumbnail into a buffer. Crop & save it.
    obj.thumb = `${obj.id}.jpg`;
    const thumb = path.join(__dirname, '..', 'public', obj.thumb);
    const thumbURL = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    request({url: thumbURL, method: 'get', encoding: null}, (err, res, buffer) => {
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
        obj.title = info.videoDetails.title;
        obj.author = info.videoDetails.author.name;
        obj.length = info.videoDetails.lengthSeconds;
        // Send video information to the client.
        res.json({obj: obj});
      })
      .catch((err) => {
        console.log(err);
        res.status(400).end();
      });
  } catch (error) {
    res.status(400).end();
        console.log(error);
  }
}

/** Use ytdl-core to fetch the video. */
function fetchMp4(obj, mp4Emitter, mp3Emitter) {
  let startTime;
  let progInt;
  let newEventID = `event${obj.id}`;
  obj.videoPath = path.join(__dirname, '..', obj.videoFile);
  const start = () => {
    const video = ytdl(obj.url, {quality: 'highestaudio'});
    video.pipe(fs.createWriteStream(obj.videoPath));
    video.once('response', () => {
      startTime = Date.now();
    });
    // Check if it is slow connection. Restart stream if so.
    video.on('progress', (chunkLength, downloaded, total) => {
      let percent = downloaded / total;
      progInt = Math.floor(percent * 100);
      let downloadedMins = (Date.now() - startTime) / 1000 / 60;
      let estimate = Math.ceil(downloadedMins / percent - downloadedMins);
      if (estimate == 0) {
        estimate = 1;
      }
      if ((obj.length / estimate) >= 800) { 
        mp4Emitter.emit(newEventID, -1); 
        video.destroy();
        start();
      } else {
        mp4Emitter.emit(newEventID, progInt);
      }
    });
    video.on('end', () => {
      if (progInt !== 100) {
        mp4Emitter.emit(newEventID, 100); 
      }
      convertMp3(obj, mp3Emitter);
    });
  };
  start();
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

/** Generate a random id (length n). */
function randID(n) {
  let id = '';
  for (let i = 0; i < n; i++) {
    let r = randomInt(62);
    if (r < 10) {
      id += r;
    } else if (r < 36) {
      id += String.fromCharCode(r + 55);
    } else {
      id += String.fromCharCode(r + 61);
    }
  }
  return id;
}


module.exports = {checkURL, fetchMp4}; 
