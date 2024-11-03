/*
 * My YouTube mp3 downloader.
 * Built on ytdl-core and ffmpeg.
 */

"use strict";

// Modules
const express = require("express");
const path = require("path");
const EventEmitter = require("events");
const { delFile, doUpdate, startProgress } = require("./js/helper");
const { checkURL, fetchMp4 } = require("./js/ytdl");

// Set some variables
const port = process.env.PORT || 3000;
const dir = path.join(__dirname, "public");
let mp3Emitter = new EventEmitter();
let mp4Emitter = new EventEmitter();

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
app.get("/video/", (req, res) => {
  checkURL(res, req.query.url);
});

// Route for mp4 progress bar.
app.get("/:id/mp4Event/", async (req, res) => {
  function mp4Update(data) {
    doUpdate(res, data, req.params.id, mp4Emitter, mp4Update);
  }
  startProgress(res, req.params.id, mp4Emitter, mp4Update);
});

// Route for mp3 progress bar.
app.get("/:id/mp3Event", async (req, res) => {
  function mp3Update(data) {
    doUpdate(res, data, req.params.id, mp3Emitter, mp3Update);
  }
  startProgress(res, req.params.id, mp3Emitter, mp3Update);
});

// This route starts the stream, extracts mp3 and adds the tags.
app.post("/mp3", (req, res) => {
  fetchMp4(req.body.obj, mp4Emitter, mp3Emitter);
  res.json({ obj: req.body.obj });
});

// Route to provide download.
app.post("/download", function (req, res) {
  const obj = req.body.obj;
  res.download(obj.audioFile);
  // Clean up files.
  setTimeout(function () {
    delFile(path.join(__dirname, "public", obj.thumb));
    delFile(path.join(__dirname, obj.audioFile));
    delFile(path.join(__dirname, obj.videoFile));
  }, 1000);
});

// Anything else.
app.all("*", function (_, res) {
  res.status(404).send("Page not found.");
});
