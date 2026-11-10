// Usage: node testClient.js <userId> <role> <sessionId> [--mute]
//   --mute : client stops answering heartbeats (simulates a frozen/dead client)

const { io } = require('socket.io-client');

const [, , userId = 'student01', role = 'student', sessionId = 'CS101', flag] = process.argv;
const mute = flag === '--mute';

const socket = io(process.env.URL || 'http://localhost:3000', {
  auth: { userId, role, sessionId },
});

socket.on('connect', () => console.log(`${userId} connected (${socket.id})`));
socket.on('disconnect', (reason) => console.log(`${userId} disconnected: ${reason}`));

// Answer the server's heartbeat. Calling the ack is the "pong".
socket.on('hb:ping', (sentAt, ack) => {
  if (!mute) ack();
});