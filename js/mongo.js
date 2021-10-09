"use strict";

// Dummy function at the moment, need to check if user exists etc.
function addUser(db, newUser, newPwd) {
  db.collection("users").insertOne({name: newUser, password: newPwd}, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Wrote user & password.");
    }
  });
}


