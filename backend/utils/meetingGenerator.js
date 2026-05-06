const generateMeetingLink = (sessionId) => {
  const roomName = `qovero-session-${sessionId}-${Date.now()}`;
  return `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true`;
};

module.exports = { generateMeetingLink };