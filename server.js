const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const publicDir = __dirname;
console.log('정적 파일 경로:', publicDir);

app.use(express.static(publicDir));

// public/index.html이 안 보일 경우를 대비한 명시적 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

let guestCounter = 0;

io.on('connection', (socket) => {
  // 접속 순서대로 guest1, guest2 ... 배정
  guestCounter += 1;
  const guestName = 'guest' + guestCounter;
  socket.data.guestName = guestName;

  // 본인에게만 자신의 이름 전달
  socket.emit('assigned-name', guestName);

  // 메시지 수신 -> 모든 접속자에게 브로드캐스트 (전송자 포함)
  const COOLDOWN_MS = 5000;
  socket.data.lastSentAt = 0;

  socket.on('chat-message', (text) => {
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim().slice(0, 500); // 길이 제한
    if (!trimmed) return;

    const now = Date.now();
    const elapsed = now - socket.data.lastSentAt;
    if (elapsed < COOLDOWN_MS) {
      // 쿨타임 위반 -> 본인에게만 알림, 브로드캐스트 안 함
      socket.emit('cooldown', { remainingMs: COOLDOWN_MS - elapsed });
      return;
    }
    socket.data.lastSentAt = now;

    io.emit('chat-message', {
      guest: guestName,
      text: trimmed,
      ts: now
    });
  });

  socket.on('disconnect', () => {
    // 별도 처리 없음 (메시지 기록은 서버 메모리에 저장하지 않음 -> 재접속 시 초기화)
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
