"use strict";

const fs = require('fs');
const path = require('path');
const id3 = require('node-id3');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

/** Turns the time-stamps into seconds as a number. */
function timeToSecs (time) {
  let h = Number(time.slice(0,2));
  let m = Number(time.slice(3,5));
  let s = Number(time.slice(6));
  s  += m * 60 + h * 360;
  return s;
};

function convertMp3(obj, mp3Emitter, res) {
  obj.audioFile = `${obj.id}.mp3`; 
  const audioPath = path.join(__dirname, '..', obj.audioFile);
  const thumbPath = path.join(__dirname, '..', 'public', `${obj.id}.jpg`);
      const writeStream = fs.createWriteStream(audioPath);
      const meta = { title: obj.title, artist: obj.artist, album: "YouTube", APIC: thumbPath };
      ffmpeg(obj.videoPath, {niceness: "10"})
        .audioCodec('libmp3lame')
        .format('mp3')
        .audioQuality(3)
        .on('error', function(err) {
          console.log(`Ffmpeg error: ${err.message}`);
          res.status(400).end();
        })
        .on('codecData' , function(data) {
          obj.dur = timeToSecs(data.duration);
        })
        .on('progress', function(progress) {
          let time = timeToSecs(progress.timemark);
          let percent = Math.floor((time / obj.dur) * 100);
          mp3Emitter.emit(`event${obj.id}`, percent);
        })
        .on('end', () => {
          const tagsWritten = id3.write(meta, audioPath);
          res.json({obj: obj});
        })
        .pipe(writeStream, {end: true});

};

module.exports = convertMp3;