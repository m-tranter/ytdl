"use strict";

function randomInt(max) {
  return Math.floor(Math.random() * max);
}


function randID(n) {
  let id = "";
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
};

module.exports = randID;