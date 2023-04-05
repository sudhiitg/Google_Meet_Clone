const express = require('express');
const app = express();
const colors = require('colors');
const server = require('http').Server(app);

// const https= require("https");
// const fs = require('fs');
// const option = {
//   key: fs.readFileSync('key.pem'),
//   cert: fs.readFileSync("cert.pem")
// };
// const server = https.createServer(option, app);

const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');
const session = require('express-session');
const Room = require('./models/room');
const { sendMail } = require('./Utils/email');

const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, { debug: true });
app.use('/peerjs', peerServer);

dotenv.config({ path: './config.env' });

app.set('view engine', 'ejs');
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  },
});

const connectDB = require('./config/db');
connectDB();

app.use(express.static('public'));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    maxAge: 24 * 60 * 60 * 1000,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  return done(null, user);
});

passport.deserializeUser((user, done) => {
  return done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    function (accessToken, refreshToken, profile, cb) {
      //console.log(profile);
      return cb(null, profile);
    }
  )
);

app.get('/auth/login', (req, res) => {
  res.render('login');
});

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/home');
  }
);

app.get('/auth/logout', (req, res) => {

  if (req.user) {
    req.logout(function (err) {
      if (err) console.log(err);
      else res.redirect('/');
    });
  }
})

app.get('/create-meeting', (req, res) => {
  if (req.user) {
    const roomId = uuidv4();
    const room = new Room({
      roomId: roomId,
      currentusers: 0,
      users: [],
    });
    room.save().then(() => {
      res.redirect('/' + roomId);
    });
  } else {
    res.redirect('/auth/login');
  }
});

app.get('/home', (req, res) => {
  if (req.user) {

    var today = new Date();
    var future = new Date(today.getTime() + 60000 * 15).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    res.render('home', { curTime: future });
  } else {
    res.redirect('/auth/login');
  }
});

app.get('/:room', (req, res) => {
  if (req.user) {
    //console.log("here", req.user);
    Room.findOne({ roomId: req.params.room }, function (err, foundRoom) {
      if (!err) {
        if (foundRoom)
          res.render('room', {
            roomId: req.params.room,
            googleid: req.user.id,
            name: req.user.displayName,
            photo: req.user.photos[0].value,
          });
        else
          res.render('notFound');
      }
    });
  } else {
    res.redirect('/auth/login');
  }
});

io.on('connection', (socket) => {
  socket.on('join-room', (roomId, name, googleid, photo, userId) => {
    console.log("joining");
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId, name, photo);
    Room.findOne({ roomId: roomId }, function (err, foundRoom) {
      if (!err) {
        if (foundRoom) {
          console.log('here2', name, googleid, photo);
          foundRoom.users.push({
            peerid: userId,
            id: googleid,
            name: name,
            photo: photo,
          });
          foundRoom.currentusers = foundRoom.currentusers + 1;
          foundRoom.save();
        }
        else {
          const room = new Room({
            roomId: roomId,
            currentusers: 0,
            users: [],
          });
          room.users.push({
            peerid: userId,
            id: googleid,
            name: name,
            photo: photo,
          });
          room.currentusers = room.currentusers + 1;
          room.save();
        }
      }
    });
    socket.on('disconnect', () => {
      console.log("disconnected");
      Room.findOne({ roomId: roomId }, function (err, foundRoom) {
        if (!err) {
          foundRoom.users.map((user) => {
            if (user.peerid == userId) {
              if (foundRoom.currentusers === 1) {
                Room.deleteOne({ roomId: roomId })
                  .then((success) => {
                    console.log(success);
                  })
                  .catch((err) => {
                    console.log(err);
                  });
              } else {
                foundRoom.currentusers = foundRoom.currentusers - 1;
                foundRoom.save();
              }
            }
          });
        }
      });
      socket.to(roomId).emit('user-disconnected', userId, name);
    });

    socket.on('message', (message, userId, userName, userPhoto) => {
      io.to(roomId).emit('createMessage', message, userId, userName, userPhoto);
    });

    socket.on('start-whiteboard', () => {
      io.to(roomId).emit('create-whiteboard');
    });

    socket.on('stop-whiteboard', () => {
      io.to(roomId).emit('remove-whiteboard');
    });

    socket.on('drawing', (data) => io.to(roomId).emit('drawing', data));
  });
});

app.post('/join', (req, res) => {
  if (req.user) {
    const meeting = req.body.meeting;
    if (meeting.includes('/'))
      res.redirect('/' + meeting.substr(meeting.length - 36, 36));
    else res.redirect('/' + meeting);
  } else {
    res.redirect('/auth/login');
  }
});

app.get('/', (req, res) => {
  if (req.user) {
    
    res.redirect('/home');
  } else {
    res.redirect('/auth/login');
  }
});

app.post('/schedule-meeting', (req, res) => {
  if (req.user) {
    //console.log(req.body);
    const userDetails = {
      userEmail: req.body.emailAddresses,
      sender: req.user
    };
    // calculate time difference
    let [h, m] = req.body.meetingTime.split(':');
    let [curh, curm] = new Date()
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      .split(':');
    h = parseInt(h);
    m = parseInt(m);
    curh = parseInt(curh);
    curm = parseInt(curm);
    let seconds = 0;
    if (h * 60 + m > curh * 60 + curm + 15) {
      seconds = (h * 60 + m - curh * 60 - curm - 15) * 60;
    } else {
      seconds = (h * 60 + m + curh * 60 + curm - 15) * 60;
    }
    console.log(seconds, seconds/60, seconds/3600);
    setTimeout(() => sendMail(userDetails), seconds * 1000);

    res.redirect('/home');
  } else {
    res.redirect('/auth/login');
  }
});

app.get('*', (req, res, next) => {
  res.status(404);
  res.render('notFound');
})

server.listen(process.env.PORT || 3000, function () {
  console.log(`Server running on port ${process.env.PORT}`.rainbow.bold);
});