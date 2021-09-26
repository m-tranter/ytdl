
"use strict";
/** Pads a number with a leading 0. */
function pad(str) {
  return (`0${str}`).slice(-2);
}

/** Logging function */
function logStr(artist, track) {
  const dateOb = new Date();
  const date = pad(dateOb.getDate());
  const month = pad(dateOb.getMonth() + 1);
  const year = dateOb.getFullYear();
  const hours = pad(dateOb.getHours());
  const minutes = pad(dateOb.getMinutes());
  const seconds = pad(dateOb.getSeconds());
  const dateStr = `${date}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  return `${dateStr} ${artist}: ${track}`;
}


module.exports = logStr;
