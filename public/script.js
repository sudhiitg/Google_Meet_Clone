const socket = io('/');

//------------------------------------------------------------------video elements
const videoGroup = document.querySelector('.videos__group');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
//------------------------------------------------------------------recording elements
const recordbtn = document.getElementById('recordButton');
const stoprecord = document.getElementById('stoprecordButton');
let mediaRecorder;
//------------------------------------------------------------------room id copy elements
const copyBtn = document.getElementById("copyBtn");
const input = document.querySelector('#meeting-room-code');
//------------------------------------------------------------------screensharing elements
const startShare = document.getElementById('presentButton');
const stopShare = document.getElementById('stoppresentButton');

const screendiv = document.getElementById('screen');
const screen = document.getElementById('screen-video');
//------------------------------------------------------------------mute, video toggle, leave elements
const inviteButton = document.querySelector('#inviteButton');
const muteButton = document.querySelector('#muteButton');
const stopVideo = document.querySelector('#stopVideo');
const leave = document.querySelector('#leaveButton');
//------------------------------------------------------------------white board elements
const startWhiteboard = document.getElementById('whiteboardButton');
const stopWhiteboard = document.getElementById('stopwhiteboardButton');

const whiteboard = document.getElementById('whiteboard-canvas');
var canvas = document.getElementsByClassName('whiteboard')[0];
var colors = document.getElementsByClassName('color');
var context = canvas.getContext('2d');

var current = {
  color: 'black',
};
var drawing = false;

//------------------------------------------------------------------chat elements
let text = document.querySelector('#chat_message');
let send = document.getElementById('send');
let messages = document.querySelector('.messages');
const toast = document.querySelector(".toast");
//------------------------------------------------------------------participants elements
let people = document.querySelector('.people');
//------------------------------------------------------------------setting meeting info
document.querySelector('#meeting-room-code').value = `${ROOM_ID}`;
document.querySelector('.small-text').innerHTML = `Joined as ${NAME}`;
//------------------------------------------------------------------user elements
var myUserId = '';
var myName = '';
var screenSharer = '';
var myPhoto = PHOTO;

myVideo.muted = true;
var myscreen = null;
var screenshared = false;
var recording = false;
let whiteboardOn = false;
let peers = {};
var displayMediaOptions = {
  video: {
    cursor: 'always',
  },
  audio: false,
};
//------------------------------------------------------------------peer element
const peer = new Peer(undefined);

//------------------------------------------------------------------ socket-peer-call-stream
let myVideoStream;
navigator.mediaDevices
  .getUserMedia({
    audio: true,
    video: true,
  })
  .then((stream) => {
    console.log(stream);
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on('call', (call) => {
      if (call.metadata.type === 'video') {
        call.answer(stream);
        //connecting to all peers that where already in the meeting and called the new peer
        call.on('close', () => {
          video.remove();
        });

        peer.connect(call.peer);
        peers[call.peer] = call;
        console.log(peers);
        console.log(call.metadata.name);
        people.innerHTML =
          people.innerHTML +
          `<div id=${call.peer} class="person">
            <b><img class="userimg" src=${call.metadata.photo}></img> <span > ${call.metadata.name}</span> </b>
        </div>`;
        const video = document.createElement('video');
        call.on('stream', (userVideoStream) => {
          addVideoStream(video, userVideoStream);
        });
      } else if (call.metadata.type === 'screensharingstopped') {
        call.answer();
        call.on('stream', (screensrc) => {
          screendiv.style.display = 'none';

          screen.srcObject = screensrc;

          startShare.style.display = 'block';
        });
      } else {
        call.answer();
        screenSharer = call.peer;
        call.on('stream', (screensrc) => {
          screendiv.style.display = 'flex';
          console.log(screensrc);
          screen.srcObject = screensrc;
          startShare.style.display = 'none';
        });
      }
    });

    socket.on('user-connected', (userId, userName, userphoto) => {
      setTimeout(() => {
        console.log('User connected: ' + userId);
        // user joined
        connectToNewUser(userId, myName, myPhoto, stream);
      }, 1000);
      showToast(`${userName} Joined`);
      people.innerHTML =
        people.innerHTML +
        `<div id=${userId} class="person">
            <b><img class="userimg" src=${userphoto} </img><span> ${userName}</span> </b>
           
        </div>`;
    });
  });

//------------------------------------------------------------------socket events

socket.on('createMessage', (message, userId, userName, userPhoto) => {
  if(userId!==myUserId){
    showToast(`message from ${userName}`);
  }

  messages.innerHTML =
    messages.innerHTML +
    `<div class="message">
          <b><img class="userimg" src=${userId === myUserId ? myPhoto : userPhoto}></img>  <span style="color:black;"> ${userId === myUserId ? 'me' : userName
    }</span> </b>
          <p>${message}</p>
      </div>`;
});

socket.on('user-disconnected', (userId, name) => {
  if (peers[userId]) {
    if (screenSharer === userId) {
      screendiv.style.display = 'none';
      screen.srcObject = null;
      startShare.style.display = 'block';
    }
    peers[userId].close();
  }
  showToast(`${name} left`)
  document.getElementById(userId).remove();
});

socket.on('create-whiteboard', () => {
  whiteboard.style.display = 'flex';
  startWhiteboard.style.display = 'none';
  stopWhiteboard.style.display = 'block';
});

socket.on('close-whiteboard', () => {
  whiteboard.style.display = 'none';
  startWhiteboard.style.display = 'block';
  stopWhiteboard.style.display = 'none';
});

socket.on('drawing', onDrawingEvent);

//------------------------------------------------------------------Functions
const connectToNewUser = (userId, myName, myPhoto, stream) => {
  console.log(userId);
  const call = peer.call(userId, stream, {
    metadata: { type: 'video', name: myName, photo: myPhoto },
  });
  const video = document.createElement('video');
  call.on('stream', (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });
  call.on('close', () => {
    video.remove();
  });
  peers[userId] = call;

  if (screenshared) {
    peer.call(userId, myscreen, { metadata: { type: 'screensharing' } });
  }
  if (whiteboardOn) {
    socket.emit('start-whiteboard');
  }
};

peer.on('open', (userId) => {
  socket.emit('join-room', ROOM_ID, NAME, GOOGLEID, PHOTO, userId);
  myName = NAME;
  myUserId = userId;
  people.innerHTML =
    people.innerHTML +
    `<div id=${myUserId} class="person">
        <b><img class="userimg" src=${myPhoto} /> <span "> ${myName}</span> </b>
       
    </div>`;
});

const addVideoStream = (video, stream) => {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
    videoGrid.append(video);
  });
};

async function startCapture() {
  try {
    myscreen = await navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions
    );
    screenshared = true;
    console.log(myscreen);
  } catch (err) {
    screendiv.style.display = 'none';
    stopShare.style.display = 'none';
    startShare.style.display = 'block';
    console.error('Error: ' + err);
  }
}

function stopCapture(evt) {
  let tracks = screen.srcObject.getTracks();
  screenshared = false;
  tracks.forEach((track) => track.stop());
  screen.srcObject = null;
}

function createRecorder(stream, mimeType) {
  let recordedChunks = [];
  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = function (e) {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };
  mediaRecorder.onstop = function () {
    let tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
    saveFile(recordedChunks);
    recordedChunks = [];
  };
  mediaRecorder.start(200); // For every 200ms the stream data will be stored in a separate chunk.
  return mediaRecorder;
}

function saveFile(recordedChunks) {
  const blob = new Blob(recordedChunks, {
    type: 'video/webm',
  });
  let filename = window.prompt('Enter file name'),
    downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `${filename}.webm`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  URL.revokeObjectURL(blob); // clear from memory
  document.body.removeChild(downloadLink);
}

async function recordScreen() {
  recording = true;
  return await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: { mediaSource: 'screen' },
  });
}

function drawLine(x0, y0, x1, y1, color, emit) {
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
  context.closePath();

  if (!emit) {
    return;
  }
  var w = canvas.width;
  var h = canvas.height;

  socket.emit('drawing', {
    x0: x0 / w,
    y0: y0 / h,
    x1: x1 / w,
    y1: y1 / h,
    color: color,
  });
}

function onMouseDown(e) {
  drawing = true;
  current.x = e.clientX || e.touches[0].clientX;
  current.y = e.clientY || e.touches[0].clientY;
}

function onMouseUp(e) {
  if (!drawing) {
    return;
  }
  drawing = false;
  drawLine(
    current.x,
    current.y,
    e.clientX || e.touches[0].clientX,
    e.clientY || e.touches[0].clientY,
    current.color,
    true
  );
}

function onMouseMove(e) {
  if (!drawing) {
    return;
  }
  drawLine(
    current.x,
    current.y,
    e.clientX || e.touches[0].clientX,
    e.clientY || e.touches[0].clientY,
    current.color,
    true
  );
  current.x = e.clientX || e.touches[0].clientX;
  current.y = e.clientY || e.touches[0].clientY;
}

function onColorUpdate(e) {
  current.color = e.target.className.split(' ')[1];
}

// limit the number of events per second
function throttle(callback, delay) {
  var previousCall = new Date().getTime();
  return function () {
    var time = new Date().getTime();

    if (time - previousCall >= delay) {
      previousCall = time;
      callback.apply(null, arguments);
    }
  };
}

function onDrawingEvent(data) {
  var w = canvas.width;
  var h = canvas.height;
  drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
}

// make the canvas fill its parent
function onResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

let toastTimer;
// the toast function
const showToast = (msg) => {
  clearTimeout(toastTimer);
  toast.innerText = msg;
  toast.classList.add("show");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
};

//------------------------------------------------------------------Event Listeners

copyBtn.addEventListener("click", () => {
  input.select()
  document.execCommand("copy")
  showToast("link copied")
})

startShare.addEventListener('click', async () => {
  screendiv.style.display = 'flex';
  startShare.style.display = 'none';
  stopShare.style.display = 'block';
  try {
    await startCapture();
  } catch (error) {

    console.log(error);
  }
  screen.srcObject = myscreen;
  Object.keys(peers).map((peerid) => {
    peer.call(peerid, myscreen, { metadata: { type: 'screensharing' } });
  });
  console.log(myscreen);
  ``;
});

stopShare.addEventListener('click', () => {
  screendiv.style.display = 'none';
  stopShare.style.display = 'none';
  startShare.style.display = 'block';
  stopCapture();
  Object.keys(peers).map((peerid) => {
    peer.call(peerid, myscreen, { metadata: { type: 'screensharingstopped' } });
  });
});

recordbtn.addEventListener('click', async function () {
  let stream = await recordScreen();
  let mimeType = 'video/webm';
  mediaRecorder = createRecorder(stream, mimeType);
  recordbtn.style.display = 'none';
  stoprecord.style.display = 'block';
});

stoprecord.addEventListener('click', function () {
  recording = false;
  mediaRecorder.stop();
  recordbtn.style.display = 'block';
  stoprecord.style.display = 'none';
});

send.addEventListener('click', (e) => {
  if (text.value.length !== 0) {
    socket.emit('message', text.value, myUserId, myName, myPhoto);
    text.value = '';
  }
});

text.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && text.value.length !== 0) {
    socket.emit('message', text.value, myUserId, myName, myPhoto);
    text.value = '';
  }
});

muteButton.addEventListener('click', () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    html = `<i class="fas fa-microphone-slash"></i>`;
    muteButton.classList.toggle('background__red');
    muteButton.innerHTML = html;
  } else {
    myVideoStream.getAudioTracks()[0].enabled = true;
    html = `<i class="fas fa-microphone"></i>`;
    muteButton.classList.toggle('background__red');
    muteButton.innerHTML = html;
  }
});

stopVideo.addEventListener('click', () => {
  const enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    html = `<i class="fas fa-video-slash"></i>`;
    stopVideo.classList.toggle('background__red');
    stopVideo.innerHTML = html;
  } else {
    myVideoStream.getVideoTracks()[0].enabled = true;
    html = `<i class="fas fa-video"></i>`;
    stopVideo.classList.toggle('background__red');
    stopVideo.innerHTML = html;
  }
});

leave.addEventListener('click', () => {
  if (recording) mediaRecorder.stop();
  socket.disconnect();
  window.location.pathname = '/home';
});

startWhiteboard.addEventListener('click', () => {
  whiteboardOn = true;
  whiteboard.style.display = 'block';
  startWhiteboard.style.display = 'none';
  stopWhiteboard.style.display = 'block';
  socket.emit('start-whiteboard');
});



stopWhiteboard.addEventListener('click', () => {
  whiteboardOn = false;
  whiteboard.style.display = 'none';
  startWhiteboard.style.display = 'block';
  stopWhiteboard.style.display = 'none';
  socket.emit('stop-whiteboard');
});




canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('mouseout', onMouseUp, false);
canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

//Touch support for mobile devices
canvas.addEventListener('touchstart', onMouseDown, false);
canvas.addEventListener('touchend', onMouseUp, false);
canvas.addEventListener('touchcancel', onMouseUp, false);
canvas.addEventListener('touchmove', throttle(onMouseMove, 10), false);

for (var i = 0; i < colors.length; i++) {
  colors[i].addEventListener('click', onColorUpdate, false);
}



window.addEventListener('resize', onResize, false);
onResize();