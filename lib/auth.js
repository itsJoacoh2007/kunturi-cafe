'use strict';

const crypto = require('crypto');
const { db, save } = require('./store');

const SESSION_COOKIE = 'kunturi_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

function createSession() {
  const store = db();
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions[token] = { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
  save();
  return token;
}

function destroySession(token) {
  const store = db();
  if (token && store.sessions[token]) {
    delete store.sessions[token];
    save();
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;
  const store = db();
  const session = store.sessions[token];
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    delete store.sessions[token];
    save();
    return false;
  }
  return true;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000,
    )}; SameSite=Lax${secure}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function getToken(req) {
  return parseCookies(req)[SESSION_COOKIE];
}

module.exports = {
  createSession,
  destroySession,
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  getToken,
};
