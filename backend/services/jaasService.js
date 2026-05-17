const crypto = require('crypto');
const { AppError } = require('../utils/errorHandler');

const base64UrlEncode = (value) =>
  Buffer.from(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const getPrivateKey = () => {
  if (process.env.JAAS_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.JAAS_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  }

  if (process.env.JAAS_PRIVATE_KEY) {
    return process.env.JAAS_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  return null;
};

const getJaasConfig = () => {
  const appId = process.env.JAAS_APP_ID;
  const keyId = process.env.JAAS_API_KEY_ID;
  const privateKey = getPrivateKey();

  if (!appId || !keyId || !privateKey) {
    throw new AppError('Video service is not configured', 503, 'JAAS_NOT_CONFIGURED');
  }

  return {
    appId,
    keyId,
    privateKey,
    domain: process.env.JAAS_DOMAIN || '8x8.vc',
    tokenTtlSeconds: Number(process.env.JAAS_TOKEN_TTL_SECONDS || 60 * 60),
  };
};

const buildRoomName = (sessionId) => `qovero-session-${sessionId}`;

const signJaasJwt = ({ sessionId, user, moderator }) => {
  const { appId, keyId, privateKey, tokenTtlSeconds } = getJaasConfig();
  const now = Math.floor(Date.now() / 1000);
  const room = buildRoomName(sessionId);
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Q-over-o user';

  const header = {
    alg: 'RS256',
    kid: keyId,
    typ: 'JWT',
  };

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room,
    nbf: now - 10,
    exp: now + tokenTtlSeconds,
    context: {
      user: {
        id: user.id,
        name: displayName,
        email: user.email || '',
        avatar: '',
        moderator: moderator ? 'true' : 'false',
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        'outbound-call': false,
      },
      room: {
        regex: false,
      },
    },
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey);

  const isValidSignature = crypto.verify(
    'RSA-SHA256',
    Buffer.from(signingInput),
    crypto.createPublicKey(privateKey),
    signature,
  );

  if (!isValidSignature) {
    throw new AppError('Video token signature could not be verified locally', 500, 'JAAS_SIGNATURE_INVALID');
  }

  return {
    appId,
    domain: process.env.JAAS_DOMAIN || '8x8.vc',
    room,
    roomName: `${appId}/${room}`,
    jwt: `${signingInput}.${base64UrlEncode(signature)}`,
    moderator,
  };
};

module.exports = {
  buildRoomName,
  signJaasJwt,
};
