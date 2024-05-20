const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();
const serviceAccount = require("./serviceAccount.json");
// import middleware to parse the body
app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// import firebase-admin functions
const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
  Filter,
} = require("firebase-admin/firestore");
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

// serving the page
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// post request to add user
app.post("/api/users", async (req, res) => {
  if (!req.body.username) {
    return res.status(400).json({
      error: "Invalid username",
    });
  } else {
    if (req.body.username)
      try {
        // Check if a user with the same name already exists
        let userSnapshot = await db
          .collection("users")
          .where("username", "==", req.body.username)
          .get();

        if (!userSnapshot.empty) {
          return res.status(400).json({
            error: "Username already exists",
          });
        }
        // add  the new user
        let newUserRef = db.collection("users").doc();
        await newUserRef.set(
          {
            username: req.body.username,
            _id: newUserRef.id,
          },
          { merge: true }
        );
        return res.status(200).json({
          username: req.body.username,
          _id: newUserRef.id,
        });
      } catch (e) {
        return res.status(400).send("Error: " + e);
      }
  }
});

// get request to get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = [];
    const usersSnapshot = await db.collection("users").get();
    usersSnapshot.forEach((doc) => {
      users.push(doc.data());
    });
    return res.status(200).json(users);
  } catch (e) {
    return res.status(400).send(e);
  }
});

// post request to add exercise
app.post("/api/users/:_id/exercises", async (req, res) => {
  if (!req.body.description || !req.body.duration || !req.params._id) {
    return res.status(400).json({
      error: "Invalid request",
    });
  } else {
    try {
      // get the user
      let userSnapshot = await db
        .collection("users")
        .where("_id", "==", req.params._id)
        .get();
      if (userSnapshot.empty) {
        return res.status(400).json({
          error: "User not found",
        });
      }

      const exerciseData = {
        description: req.body.description,
        //convert duration to number
        duration: parseInt(req.body.duration),
        date: req.body.date
          ? new Date(req.body.date).toDateString()
          : new Date().toDateString(),
      };
      // add the exercise in the user's document
      let userRef = db.collection("users").doc(req.params._id);
      await userRef.set(
        {
          log: FieldValue.arrayUnion(exerciseData),
        },
        { merge: true }
      );

      const data = {
        _id: req.params._id,
        username: userSnapshot.docs[0].data().username,
        ...exerciseData,
      };

      return res.status(200).json(data);
    } catch (e) {
      return res.status(400).send("Error: " + e);
    }
  }
});

// get request to get all exercises
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    let userSnapshot = await db
      .collection("users")
      .where("_id", "==", req.params._id)
      .get();
    if (userSnapshot.empty) {
      return res.status(400).json({
        error: "User not found",
      });
    }
    const user = userSnapshot.docs[0].data();
    let logs = user.log;
    if (req.query.from) {
      logs = logs.filter(
        (log) => new Date(log.date) >= new Date(req.query.from)
      );
    }
    if (req.query.to) {
      logs = logs.filter((log) => new Date(log.date) <= new Date(req.query.to));
    }
    if (req.query.limit) {
      logs = logs.slice(0, req.query.limit);
    }
    return res.status(200).json({
      _id: req.params._id,
      username: user.username,
      count: logs.length,
      log: logs,
    });
  } catch (e) {
    return res.status(400).send("Error: " + e);
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
