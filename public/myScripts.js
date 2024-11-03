'use strict';
/** Swap artist & title fields. */
function swap() {
  let temp = formTitle.value;
  formTitle.value = formArtist.value;
  formArtist.value = temp;
}

/** Pads a number with a leading 0. */
function pad(str) {
  return `0${str}`.slice(-2);
}

/** Human-friendly video length. */
function lengthStr(s) {
  let msg = 'Video length: ';
  let hours;
  let mins = Math.floor(s / 60);
  let seconds = s - mins * 60;
  if (mins > 59) {
    hours = Math.floor(mins / 60);
    mins = mins - hours * 60;
    msg += `${hours}:${pad(mins)}:${pad(seconds)}`;
  } else {
    msg += `${pad(mins)}:${pad(seconds)}`;
  }
  return `${msg}&nbsp;`;
}

/** Uses the video title to try to guess the tags. */
function getTags(title, author) {
  var track;
  var artist;
  var end = title.indexOf('[');
  if (end == -1) {
    end = title.indexOf('(Official');
  }
  if (end == -1) {
    end = title.indexOf('(Lyric');
  }
  if (end != -1) {
    title = title.slice(0, end).trim();
  }

  var ind = title.indexOf(' --');
  if (ind == -1) {
    ind = title.indexOf(' - ');
  }
  if (ind != -1) {
    track = title.slice(ind + 3).trim();
    artist = title.slice(0, ind).trim();
  } else {
    track = title;
    end = author.indexOf('- Topic');
    if (end != -1) {
      author = author.slice(0, end).trim();
    }
    artist = author;
  }
  return { track: track, artist: artist };
}
