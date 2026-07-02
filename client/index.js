//DEPRECATED

// let chat = true
// let chat_btn = document.getSelection("")

// let ws = "ws://localhost:3000"
// let websocket = new WebSocket(ws)
// const pc = new RTCPeerConnection();
// let role = localStorage.getItem("role")
// let userId = localStorage.getItem("user")

// let remoteStream = new MediaStream()
// window.addEventListener("load", () => {
//   const video = document.getElementById("remoteVideo");
//   video.srcObject = remoteStream;
//   video.autoplay = true;
// video.playsInline = true;
// video.muted = true;
// video.play().catch(console.error);
// });

// pc.ontrack = (event) => {
//   event.streams[0].getTracks().forEach(track => {
//     remoteStream.addTrack(track)
//   })

// }

// //EVENT LISTENERS
//     websocket.addEventListener("message", async (e)=>{
//     let data = JSON.parse(e.data)

//     if(data.type == "answer"){
//         await pc.setRemoteDescription(data.answer)
//     }
//     //the client now responds
//     if(data.type == "offer"){
//         await pc.setRemoteDescription(data.offer);
//         let answer = await pc.createAnswer()

//         await pc.setLocalDescription(answer)

//         websocket.send(JSON.stringify({
//             type: "answer",
//             answer: pc.localDescription,
//             to: data.from || "admin"
//         }))
//     }

//     if(data.type == "ice"){
//         if (data.candidate) {
//         await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
// }
//     }
// })

//             websocket.addEventListener("open", ()=>{
//             websocket.send(JSON.stringify({
//                 role: role,
//                 type: "register",
//                 id: userId
//             }))
//             console.log("connection open")
//             })

//             //PUB/SUB
//             window.addEventListener("load", ()=>{role == 'client' ? joinRoom(): createRoom()})

//         async function createRoom(){

//             const stream = await navigator.mediaDevices.getUserMedia({
//                 video: true,
//                 audio: true
//             });

//                         //STREAMING
//             stream.getTracks().forEach(track => {
//                 pc.addTrack(track, stream)
//             });
//               pc.onicecandidate = (event) => {
//             if (event.candidate) {
//             websocket.send(JSON.stringify({
//                 type: "ice",
//                 candidate: event.candidate,
//                 to: "client"
//             }))
//             }
//         }

//             let offer = await pc.createOffer();
//             await pc.setLocalDescription(offer)

//                websocket.send(JSON.stringify({
//                 type: "offer",
//                 offer: pc.localDescription,
//                 to:"client"
//             }))
//         }

// async function joinRoom() {

//   const stream = await navigator.mediaDevices.getUserMedia({
//     video: true,
//     audio: true
//   })

//   stream.getTracks().forEach(track => {
//     pc.addTrack(track, stream)
//   })

//   pc.onicecandidate = (event) => {
//     if (event.candidate) {
//       websocket.send(JSON.stringify({
//         type: "ice",
//         candidate: event.candidate,
//         to: "admin"
//       }))
//     }
//   }
// }
const isLocalHost = ['localhost', '127.0.0.1'].includes(
  window.location.hostname
);
const defaultSignalingUrl = isLocalHost
  ? 'ws://localhost:8080/ws'
  : 'wss://mooz-obhv.onrender.com/ws';
const ws = localStorage.getItem('signalingUrl') || defaultSignalingUrl;
const websocket = new WebSocket(ws);

const role = localStorage.getItem('role');
const userId = localStorage.getItem('user');
const userName = localStorage.getItem('name') || 'Anonymous';

const peerConnections = new Map();
const remoteStreams = new Map();
const presentationStreams = new Map();
const presentationSenders = new Map();
const peerPrimaryStreamIds = new Map();
const peerNames = new Map();

let localStream = null;
let audioEnabled = true;
let videoEnabled = true;
let screenStream = null;
let screenPeerId = null;
let activePresenterId = null;
let activePresenterName = '';

let unreadCount = 0;

const MIN_GRID_TILE_WIDTH = 220;
const MIN_GRID_TILE_HEIGHT = 124;
const MIN_STRIP_TILE_WIDTH = 180;
const MIN_STRIP_TILE_HEIGHT = 100;

//Interactive connectivity establishment config setup
//Stun and Turn fallback servers
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

const AVATAR_COLORS = [
  '#e74c6f',
  '#e7a23c',
  '#3ca9e7',
  '#8c3ce7',
  '#3ce76f',
  '#e7563c',
  '#3ce7d4',
];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function layoutTiles() {
  const area = document.getElementById('gridArea');
  const gap = 6;
  const pad = gap;
  const W = area.clientWidth - pad * 2;
  const H = area.clientHeight - pad * 2;
  const presenterTileId = getPresentationTileId();

  setPresentationTileState(presenterTileId);

  if (presenterTileId) {
    layoutPresenting(W, H, pad, gap, presenterTileId);
  } else {
    layoutGrid(W, H, pad, gap);
  }
}

function getPresentationTileId() {
  if (screenStream && screenPeerId) return screenPeerId;
  if (activePresenterId && presentationStreams.has(activePresenterId)) {
    return `presentation-${activePresenterId}`;
  }
  return null;
}

function fitWithinBox(boxW, boxH, aspectRatio) {
  if (!aspectRatio || !isFinite(aspectRatio) || aspectRatio <= 0) {
    return { width: boxW, height: boxH, offsetX: 0, offsetY: 0 };
  }

  let width = boxW;
  let height = width / aspectRatio;

  if (height > boxH) {
    height = boxH;
    width = height * aspectRatio;
  }

  return {
    width,
    height,
    offsetX: (boxW - width) / 2,
    offsetY: (boxH - height) / 2,
  };
}

function getTileAspectRatio(tile) {
  const video = tile?.querySelector('video');
  const aspectRatio = Number(tile?.dataset.aspectRatio);
  if (aspectRatio > 0) return aspectRatio;
  if (video?.videoWidth && video?.videoHeight) {
    return video.videoWidth / video.videoHeight;
  }
  return 16 / 9;
}

function applyTileBox(tile, x, y, boxW, boxH) {
  const { width, height, offsetX, offsetY } = fitWithinBox(
    boxW,
    boxH,
    getTileAspectRatio(tile)
  );

  tile.style.left = x + offsetX + 'px';
  tile.style.top = y + offsetY + 'px';
  tile.style.width = width + 'px';
  tile.style.height = height + 'px';
  tile.style.display = 'block';
}

function getTilePeerId(tile) {
  if (!tile || !tile.id) return '';
  if (tile.id === 'overflowTile') return 'overflow';
  return tile.id.replace(/^wrapper-/, '');
}

function setPresentationTileState(presenterTileId) {
  document
    .querySelectorAll('.video-wrapper.presentation')
    .forEach((tile) => tile.classList.remove('presentation'));

  if (!presenterTileId) return;

  const tile =
    document.getElementById(presenterTileId) ||
    document.getElementById(`wrapper-${presenterTileId}`);
  if (tile) tile.classList.add('presentation');
}

function isActivePresenterTile(tile) {
  const presenterTileId = getPresentationTileId();
  if (!presenterTileId) return false;
  const peerId = getTilePeerId(tile);
  return peerId === presenterTileId;
}

function getOverflowTile() {
  const area = document.getElementById('gridArea');
  let tile = document.getElementById('overflowTile');

  if (!tile) {
    tile = document.createElement('div');
    tile.id = 'overflowTile';
    tile.className = 'video-wrapper overflow-tile';
    tile.setAttribute('data-overflow', 'true');

    const title = document.createElement('div');
    title.className = 'overflow-title';
    title.textContent = '+0 more';

    const subtitle = document.createElement('div');
    subtitle.className = 'overflow-subtitle';
    subtitle.textContent = 'Other participants are hidden';

    tile.appendChild(title);
    tile.appendChild(subtitle);
    area.appendChild(tile);
  }

  return tile;
}

function hideOverflowTile() {
  const tile = document.getElementById('overflowTile');
  if (tile) tile.style.display = 'none';
}

function showOverflowTile(hiddenCount, totalCount) {
  const tile = getOverflowTile();
  const title = tile.querySelector('.overflow-title');
  const subtitle = tile.querySelector('.overflow-subtitle');

  title.textContent = `+${hiddenCount} more`;
  subtitle.textContent = `${totalCount} total participants`;
  tile.style.display = 'flex';
}

function bestGrid(count, W, H) {
  // Find cols/rows that best fills the area at 16:9 without wasting space
  let best = { cols: 1, rows: 1, tileW: 0, tileH: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = (W - (cols - 1) * 6) / cols;
    const tileH = tileW / (16 / 9);
    const totalH = tileH * rows + (rows - 1) * 6;
    if (totalH <= H) {
      // Check if scaling up by height gives a better fit
      const scaledH = (H - (rows - 1) * 6) / rows;
      const scaledW = scaledH * (16 / 9);
      const totalW = scaledW * cols + (cols - 1) * 6;
      const usedArea =
        totalW <= W ? scaledW * scaledH * count : tileW * tileH * count;
      if (usedArea > best.cols * best.tileW * best.tileH * best.rows) {
        best = { cols, rows, tileW, tileH };
      }
    }
  }
  return best;
}

function measureGrid(count, W, H, gap) {
  const { cols, rows } = bestFit(count, W, H, gap);
  return {
    cols,
    rows,
    tileW: (W - (cols - 1) * gap) / cols,
    tileH: (H - (rows - 1) * gap) / rows,
  };
}

function getMaxGridTiles(W, H, gap, totalCount) {
  let capacity = 1;

  for (let visibleCount = 1; visibleCount <= totalCount; visibleCount++) {
    const { tileW, tileH } = measureGrid(visibleCount, W, H, gap);
    if (tileW >= MIN_GRID_TILE_WIDTH && tileH >= MIN_GRID_TILE_HEIGHT) {
      capacity = visibleCount;
    }
  }

  return totalCount > 1 ? Math.max(2, capacity) : 1;
}

function layoutGrid(W, H, pad, gap) {
  const tiles = getOrderedTiles();
  const count = tiles.length;
  if (!count) return;

  hideOverflowTile();

  const capacity = getMaxGridTiles(W, H, gap, count);
  const needsOverflow = count > capacity;
  const visibleTiles = tiles.slice(0, needsOverflow ? capacity - 1 : capacity);
  const tilesToLayout = needsOverflow
    ? [...visibleTiles, getOverflowTile()]
    : visibleTiles;
  const renderCount = tilesToLayout.length;

  if (needsOverflow) {
    showOverflowTile(count - visibleTiles.length, count);
  }

  const { cols, rows } = bestFit(renderCount, W, H, gap);
  const tileW = (W - (cols - 1) * gap) / cols;
  const tileH = (H - (rows - 1) * gap) / rows;

  tilesToLayout.forEach((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Center the last incomplete row
    const rowCount = Math.ceil(renderCount / cols);
    const tilesInThisRow =
      row === rowCount - 1 ? renderCount - row * cols : cols;
    const rowOffsetX = ((cols - tilesInThisRow) * (tileW + gap)) / 2;

    const x = pad + col * (tileW + gap) + rowOffsetX;
    const y = pad + row * (tileH + gap);
    applyTileBox(tile, x, y, tileW, tileH);
  });

  tiles.slice(visibleTiles.length).forEach((tile) => {
    tile.style.display = 'none';
  });
}

function layoutPresenting(W, H, pad, gap, presenterTileId) {
  const screenTile =
    document.getElementById(presenterTileId) ||
    document.getElementById(`wrapper-${presenterTileId}`);
  const participants = getOrderedTiles().filter(
    (t) => t.id !== presenterTileId && t.id !== `wrapper-${presenterTileId}`
  );
  const pCount = participants.length;

  if (!screenTile) return;

  if (pCount === 0) {
    // Full screen
    applyTileBox(screenTile, pad, pad, W, H);
    return;
  }

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Top 65% screen share, bottom strip
    const stripH = Math.min(110, H * 0.3);
    const screenH = H - stripH - gap;
    const capacity = Math.max(
      2,
      Math.floor((W + gap) / (MIN_STRIP_TILE_WIDTH + gap))
    );
    const needsOverflow = pCount > capacity;
    const visibleParticipants = participants.slice(
      0,
      needsOverflow ? capacity - 1 : capacity
    );
    const stripTiles = needsOverflow
      ? [...visibleParticipants, getOverflowTile()]
      : visibleParticipants;

    applyTileBox(screenTile, pad, pad, W, screenH);

    if (needsOverflow) {
      showOverflowTile(pCount - visibleParticipants.length, pCount);
    } else {
      hideOverflowTile();
    }

    const thumbW = (W - (stripTiles.length - 1) * gap) / stripTiles.length;
    const thumbH = stripH;
    stripTiles.forEach((tile, i) => {
      const x = pad + i * (thumbW + gap);
      const y = pad + screenH + gap;
      applyTileBox(tile, x, y, thumbW, thumbH);
    });

    participants.slice(visibleParticipants.length).forEach((tile) => {
      tile.style.display = 'none';
    });
  } else {
    // Left half screen share, right strip
    const stripW = Math.min(200, W * 0.25);
    const screenW = W - stripW - gap;
    const capacity = Math.max(
      2,
      Math.floor((H + gap) / (MIN_STRIP_TILE_HEIGHT + gap))
    );
    const needsOverflow = pCount > capacity;
    const visibleParticipants = participants.slice(
      0,
      needsOverflow ? capacity - 1 : capacity
    );
    const stripTiles = needsOverflow
      ? [...visibleParticipants, getOverflowTile()]
      : visibleParticipants;

    applyTileBox(screenTile, pad, pad, screenW, H);

    if (needsOverflow) {
      showOverflowTile(pCount - visibleParticipants.length, pCount);
    } else {
      hideOverflowTile();
    }

    const thumbH = (H - (stripTiles.length - 1) * gap) / stripTiles.length;
    const thumbW = stripW;
    stripTiles.forEach((tile, i) => {
      const x = pad + screenW + gap;
      const y = pad + i * (thumbH + gap);
      applyTileBox(tile, x, y, thumbW, thumbH);
    });

    participants.slice(visibleParticipants.length).forEach((tile) => {
      tile.style.display = 'none';
    });
  }
}

// Find best cols/rows to fill W×H with `count` tiles at 16:9
function bestFit(count, W, H, gap) {
  let bestCols = 1,
    bestRows = count,
    bestArea = 0;

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = (W - (cols - 1) * gap) / cols;
    const tileH = tileW / (16 / 9);
    const totalH = tileH * rows + (rows - 1) * gap;

    if (totalH > H) continue; // doesn't fit vertically

    const area = tileW * tileH * count;
    if (area > bestArea) {
      bestArea = area;
      bestCols = cols;
      bestRows = rows;
    }
  }

  // Also try fitting by height
  for (let rows = 1; rows <= count; rows++) {
    const cols = Math.ceil(count / rows);
    const tileH = (H - (rows - 1) * gap) / rows;
    const tileW = tileH * (16 / 9);
    const totalW = tileW * cols + (cols - 1) * gap;

    if (totalW > W) continue;

    const area = tileW * tileH * count;
    if (area > bestArea) {
      bestArea = area;
      bestCols = cols;
      bestRows = rows;
    }
  }

  return { cols: bestCols, rows: bestRows };
}

function getOrderedTiles() {
  const area = document.getElementById('gridArea');
  return Array.from(
    area.querySelectorAll('.video-wrapper:not([data-overflow="true"])')
  ).sort((a, b) => {
    const aActive = isActivePresenterTile(a);
    const bActive = isActivePresenterTile(b);

    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    const presenterTileId = getPresentationTileId();
    if (presenterTileId) {
      const aScreen =
        a.id === presenterTileId || a.id === `wrapper-${presenterTileId}`;
      const bScreen =
        b.id === presenterTileId || b.id === `wrapper-${presenterTileId}`;
      if (aScreen && !bScreen) return -1;
      if (!aScreen && bScreen) return 1;
    }

    if (a.id === 'wrapper-local') return -1;
    if (b.id === 'wrapper-local') return 1;

    return a.id.localeCompare(b.id);
  });
}

function getActiveOutboundStream() {
  return localStream;
}

function attachPresentationTrack(peerId, peer) {
  if (!screenStream || screenPeerId !== `screen-${userId}`) return;

  const screenTrack = screenStream.getVideoTracks()[0];
  if (!screenTrack) return;

  if (presentationSenders.has(peerId)) return;

  const sender = peer.addTrack(screenTrack, screenStream);
  presentationSenders.set(peerId, sender);
}

async function renegotiatePeerConnection(peerId) {
  const peer = peerConnections.get(peerId);
  if (!peer || peer.connectionState === 'closed') return;

  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    websocket.send(
      JSON.stringify({
        type: 'offer',
        offer: peer.localDescription,
        to: peerId,
      })
    );
  } catch (err) {
    console.error('renegotiate error:', err);
  }
}

function removePresentationTrack(peerId) {
  const sender = presentationSenders.get(peerId);
  if (!sender) return;

  sender.replaceTrack(null).catch(() => {});
  presentationSenders.delete(peerId);
}

function addPresentationElement(peerId, stream, label) {
  if (document.getElementById(`presentation-${peerId}`)) return;

  const area = document.getElementById('gridArea');
  const wrapper = document.createElement('div');
  wrapper.id = `presentation-${peerId}`;
  wrapper.className = 'video-wrapper presentation';

  const video = document.createElement('video');
  video.id = `presentation-video-${peerId}`;
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = false;

  const labelTag = document.createElement('span');
  labelTag.className = 'video-label';
  labelTag.textContent = `${label || peerId.slice(0, 6)} (presentation)`;

  wrapper.appendChild(video);
  wrapper.appendChild(labelTag);
  area.appendChild(wrapper);

  syncTileAspectFromVideo(wrapper, video);
  video.play().catch(console.error);
  layoutTiles();
}

function removePresentationElement(peerId) {
  const wrapper = document.getElementById(`presentation-${peerId}`);
  if (wrapper) wrapper.remove();
  presentationStreams.delete(peerId);
  peerPrimaryStreamIds.delete(peerId);
}

function syncTileAspectFromVideo(wrapper, video) {
  if (!wrapper || !video) return;

  const update = () => {
    if (video.videoWidth && video.videoHeight) {
      wrapper.dataset.aspectRatio = String(
        video.videoWidth / video.videoHeight
      );
      layoutTiles();
    }
  };

  if (video.readyState >= 1) {
    update();
  } else {
    video.addEventListener('loadedmetadata', update, { once: true });
  }
}

// Rerun layout on resize
const ro = new ResizeObserver(() => layoutTiles());
ro.observe(document.getElementById('gridArea'));

// VIDEO TILES

function addVideoElement(peerId, stream, label) {
  if (document.getElementById(`wrapper-${peerId}`)) return;

  const area = document.getElementById('gridArea');
  const wrapper = document.createElement('div');
  wrapper.id = `wrapper-${peerId}`;
  wrapper.className = 'video-wrapper';

  const video = document.createElement('video');
  video.id = `video-${peerId}`;
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = false;

  const placeholder = document.createElement('div');
  placeholder.className = 'cam-off-placeholder';
  const avatar = document.createElement('div');
  avatar.className = 'cam-avatar';
  avatar.style.background = avatarColor(label || peerId);
  avatar.textContent = (label || '?')[0].toUpperCase();
  const nameSpan = document.createElement('span');
  nameSpan.textContent = label || peerId.slice(0, 6);
  placeholder.appendChild(avatar);
  placeholder.appendChild(nameSpan);

  const nameTag = document.createElement('span');
  nameTag.className = 'video-label';
  nameTag.textContent = label || peerId.slice(0, 6);

  wrapper.appendChild(video);
  wrapper.appendChild(placeholder);
  wrapper.appendChild(nameTag);
  area.appendChild(wrapper);

  syncTileAspectFromVideo(wrapper, video);

  video.play().catch(console.error);
  layoutTiles();
  updateParticipantCount();
}

function removeVideoElement(peerId) {
  const wrapper = document.getElementById(`wrapper-${peerId}`);
  if (wrapper) wrapper.remove();
  layoutTiles();
  updateParticipantCount();
}

function updateParticipantCount() {
  const count = 1 + peerConnections.size;
  document.getElementById('participantCount').textContent =
    `${count} Participant${count !== 1 ? 's' : ''}`;
}

function setTileCamState(peerId, on) {
  const wrapper = document.getElementById(`wrapper-${peerId}`);
  if (wrapper) wrapper.classList.toggle('cam-off', !on);
}

// PEER CONNECTIONS

function createPeerConnection(peerId, initiator) {
  if (peerConnections.has(peerId)) return peerConnections.get(peerId);

  //Here we pass the ice servers to the rtc constructor to create a doorway for peers to connect directly to us.
  const peer = new RTCPeerConnection(ICE_CONFIG);
  peerConnections.set(peerId, peer);

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      websocket.send(
        JSON.stringify({ type: 'ice', candidate: event.candidate, to: peerId })
      );
    }
  };

  peer.ontrack = (event) => {
    const incomingStream = event.streams[0];
    if (!incomingStream) return;

    const primaryStreamId = peerPrimaryStreamIds.get(peerId);
    if (!primaryStreamId) {
      peerPrimaryStreamIds.set(peerId, incomingStream.id);
    }

    const isPresentationTrack =
      activePresenterId === peerId &&
      event.track.kind === 'video' &&
      incomingStream.id !== peerPrimaryStreamIds.get(peerId);

    if (isPresentationTrack) {
      let stream = presentationStreams.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        presentationStreams.set(peerId, stream);
        const label = peerNames.get(peerId) || peerId.slice(0, 6);
        addPresentationElement(peerId, stream, label);
      }

      incomingStream.getTracks().forEach((track) => {
        if (!stream.getTracks().find((t) => t.id === track.id)) {
          stream.addTrack(track);
        }
      });
      return;
    }

    let stream = remoteStreams.get(peerId);
    if (!stream) {
      stream = new MediaStream();
      remoteStreams.set(peerId, stream);
      const label = peerNames.get(peerId) || peerId.slice(0, 6);
      addVideoElement(peerId, stream, label);
    }
    incomingStream.getTracks().forEach((track) => {
      if (!stream.getTracks().find((t) => t.id === track.id)) {
        stream.addTrack(track);
      }
    });
    if (event.track.kind === 'video') setTileCamState(peerId, true);
  };

  peer.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
      peer.close();
      peerConnections.delete(peerId);
      remoteStreams.delete(peerId);
      peerNames.delete(peerId);
      removeVideoElement(peerId);
    }
  };

  const outboundStream = getActiveOutboundStream();
  if (outboundStream) {
    outboundStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, outboundStream));
  }

  if (screenStream && screenPeerId === `screen-${userId}`) {
    attachPresentationTrack(peerId, peer);
  }

  if (initiator) {
    peer
      .createOffer()
      .then((offer) => peer.setLocalDescription(offer))
      .then(() =>
        websocket.send(
          JSON.stringify({
            type: 'offer',
            offer: peer.localDescription,
            to: peerId,
          })
        )
      )
      .catch(console.error);
  }

  return peer;
}

// WEBSOCKET Events

websocket.addEventListener('open', () => {
  websocket.send(
    JSON.stringify({ type: 'register', role, id: userId, name: userName })
  );
});

websocket.addEventListener('message', async (e) => {
  const data = JSON.parse(e.data);

  if (data.type === 'room_state') {
    if (data.presenter) {
      activePresenterId = data.presenter.id || null;
      activePresenterName = data.presenter.name || '';
    }
    for (const peer of data.peers) {
      peerNames.set(peer.id, peer.name);
      createPeerConnection(peer.id, true);
    }
    layoutTiles();
  }
  //listen for when a peer joins
  if (data.type === 'peer_joined') {
    peerNames.set(data.peerId, data.name);
  }

  if (data.type === 'present_state') {
    activePresenterId = data.presenter ? data.presenter.id : null;
    activePresenterName = data.presenter ? data.presenter.name || '' : '';

    if (!activePresenterId) {
      for (const peerId of Array.from(presentationStreams.keys())) {
        removePresentationElement(peerId);
      }
    }

    layoutTiles();
  }

  if (data.type === 'present_denied') {
    alert(data.message || 'someone is already presenting');
  }
  //for when a peer sends an offer
  if (data.type === 'offer') {
    if (data.name) peerNames.set(data.from, data.name);
    const peer = createPeerConnection(data.from, false);
    await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    websocket.send(
      JSON.stringify({
        type: 'answer',
        answer: peer.localDescription,
        to: data.from,
      })
    );
  }

  //response to my offer
  if (data.type === 'answer') {
    const peer = peerConnections.get(data.from);
    if (peer)
      await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  if (data.type === 'ice') {
    if (!data.candidate) return;
    try {
      const peer = peerConnections.get(data.from);
      if (peer) await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error('ICE error:', err);
    }
  }

  if (data.type === 'peer_left') {
    const peer = peerConnections.get(data.peerId);
    if (peer) {
      peer.close();
      peerConnections.delete(data.peerId);
    }
    remoteStreams.delete(data.peerId);
    peerNames.delete(data.peerId);
    removeVideoElement(data.peerId);
  }

  if (data.type === 'mesg') {
    const container = document.getElementById('chatMessages');
    const msg = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = data.name;
    msg.appendChild(name);
    msg.appendChild(document.createTextNode(data.mesg));
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    if (data.from != userId) {
      unreadCount++;
      updateUnreadCount();
    }
  }
});

function updateUnreadCount() {
  const unreadCountElem = document.getElementById('unread-count');
  if (unreadCount > 0) {
    unreadCountElem.textContent = unreadCount;
    unreadCountElem.style.display = 'inline-block';
  } else {
    unreadCountElem.style.display = 'none';
  }
}

// SETUP

async function setup() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  const localVideo = document.getElementById('localVideo');
  if (localVideo) {
    localVideo.srcObject = localStream;
    syncTileAspectFromVideo(
      document.getElementById('wrapper-local'),
      localVideo
    );
    localVideo.play().catch(console.error);
  }

  updateParticipantCount();
  layoutTiles();

  websocket.send(
    JSON.stringify({ type: 'client_ready', id: userId, name: userName })
  );
}

websocket.addEventListener('open', () => setTimeout(setup, 100));

// CHAT

function sendMessage() {
  const input = document.getElementById('chatInput');
  if (!input.value.trim()) return;
  websocket.send(
    JSON.stringify({
      type: 'mesg',
      mesg: input.value,
      name: userName,
      id: userId,
    })
  );
  input.value = '';
}

document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// CONTROLS

document.getElementById('audioBtn')?.addEventListener('click', () => {
  if (!localStream) return;
  audioEnabled = !audioEnabled;
  localStream.getAudioTracks().forEach((t) => (t.enabled = audioEnabled));
  document.getElementById('audioBtn').innerHTML =
    `Mic <b>${audioEnabled ? 'On' : 'Off'}</b>`;
});

document.getElementById('videoBtn')?.addEventListener('click', () => {
  if (!localStream) return;
  videoEnabled = !videoEnabled;
  localStream.getVideoTracks().forEach((t) => (t.enabled = videoEnabled));
  document.getElementById('videoBtn').innerHTML =
    `Cam <b>${videoEnabled ? 'On' : 'Off'}</b>`;
  setTileCamState('local', videoEnabled);
});

document.getElementById('chatToggle')?.addEventListener('click', () => {
  document.querySelector('.main-container').classList.toggle('chat-open');
  unreadCount = 0;
  updateUnreadCount();
});

document.getElementById('chatClose')?.addEventListener('click', () => {
  document.querySelector('.main-container').classList.remove('chat-open');
  unreadCount = 0;
  updateUnreadCount();
});

document.getElementById('leaveBtn')?.addEventListener('click', () => {
  localStream?.getTracks().forEach((t) => t.stop());
  websocket.close();
  window.location.href = './connect.html';
});

// SCREEN SHARE

document.getElementById('presentBtn')?.addEventListener('click', async () => {
  if (screenStream) {
    stopPresenting();
    return;
  }

  if (activePresenterId && activePresenterId !== userId) {
    alert('someone is already presenting');
    return;
  }

  try {
    const response = await websocketSendJson({
      type: 'present_request',
      id: userId,
      name: userName,
    });

    if (!response.ok) {
      return;
    }

    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false,
    });
    screenPeerId = 'screen-' + userId;
    presentationStreams.clear();

    // Add screen tile into the grid area
    const area = document.getElementById('gridArea');
    const wrapper = document.createElement('div');
    wrapper.id = `wrapper-${screenPeerId}`;
    wrapper.className = 'video-wrapper';
    wrapper.dataset.localScreen = 'true';
    const vid = document.createElement('video');
    vid.srcObject = screenStream;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.muted = true;
    const lbl = document.createElement('span');
    lbl.className = 'video-label';
    lbl.textContent = `${userName} (screen)`;
    wrapper.appendChild(vid);
    wrapper.appendChild(lbl);
    area.insertBefore(wrapper, area.firstChild); // screen first so layout puts it left/top
    syncTileAspectFromVideo(wrapper, vid);
    vid.play().catch(console.error);

    for (const [peerId, peer] of peerConnections) {
      attachPresentationTrack(peerId, peer);
      renegotiatePeerConnection(peerId);
    }

    document.getElementById('presentBtn').innerHTML = 'Stop';
    document.getElementById('presentBtn').classList.add('presenting-active');

    layoutTiles();

    screenStream.getVideoTracks()[0].addEventListener('ended', stopPresenting);
  } catch (err) {
    if (err.name !== 'NotAllowedError') console.error('getDisplayMedia:', err);
    screenStream = null;
    screenPeerId = null;
  }
});

function websocketSendJson(payload) {
  return new Promise((resolve, reject) => {
    if (websocket.readyState !== WebSocket.OPEN) {
      resolve({ ok: false });
      return;
    }

    const token = Math.random().toString(36).slice(2);
    const message = { ...payload, token };
    let timeoutId = null;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.replyTo !== token) return;
        websocket.removeEventListener('message', handleMessage);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(data);
      } catch (error) {
        websocket.removeEventListener('message', handleMessage);
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      }
    };

    websocket.addEventListener('message', handleMessage);
    websocket.send(JSON.stringify(message));

    timeoutId = setTimeout(() => {
      websocket.removeEventListener('message', handleMessage);
      resolve({ ok: false });
    }, 3000);
  });
}

function stopPresenting() {
  if (!screenStream) return;

  for (const peerId of Array.from(presentationSenders.keys())) {
    removePresentationTrack(peerId);
    renegotiatePeerConnection(peerId);
  }

  screenStream.getTracks().forEach((t) => t.stop());
  screenStream = null;

  const wrapper = document.getElementById(`wrapper-${screenPeerId}`);
  if (wrapper) wrapper.remove();
  screenPeerId = null;

  for (const peerId of Array.from(presentationStreams.keys())) {
    removePresentationElement(peerId);
  }

  if (localStream) {
    const cam = localStream.getVideoTracks()[0];
    for (const [, peer] of peerConnections) {
      const sender = peer
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');
      if (sender && cam) sender.replaceTrack(cam).catch(console.error);
    }
  }

  websocket.send(
    JSON.stringify({ type: 'present_release', id: userId, name: userName })
  );

  document.getElementById('presentBtn').innerHTML = 'Present';
  document.getElementById('presentBtn').classList.remove('presenting-active');

  layoutTiles();
}
