/*
 *Helper functions.
 */

"use strict";
const fs = require("fs");

/** Pads a number with a leading 0. */
function pad(str) {
  return `0${str}`.slice(-2);
}

/** Write progress info to the response. */
function doUpdate(res, data, id, emitter, callback) {
  const percent = JSON.stringify(data);
  res.write(`event: progress${id}\n`);
  res.write(`data: ${percent}`);
  res.write("\n\n");
  if (data == 100) {
    res.end();
    emitter.removeListener(`event${id}`, callback);
  }
}

/** Initiate the progress event emitter. */
function startProgress(res, id, emitter, callback) {
  console.log("start");
  console.log(id);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  emitter.on(`event${id}`, callback);
}

/** Delete files from the server. */
function delFile(file) {
  fs.unlink(file, function (err) {
    if (err) {
      console.log(`Error deleting file: ${file}.`);
    }
  });
}

module.exports = { delFile, doUpdate, startProgress };
