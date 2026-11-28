import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const send = (res, status, data) => res.status(status).json(data);
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const CREDENTIALS_KEY = "edukot:passkeys:teacher";
const CHALLENGE_TTL = 300;

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Brakuje ustawień Upstash Redis w Vercel.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error("Błąd połączenia z bazą Upstash.");
  return result.result;
}

function requestOrigin(req) {
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  let parsed;
  try { parsed = new URL(origin); } catch { throw new Error("Brak prawidłowego adresu Origin."); }
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== host) {
    throw new Error("Passkey działa tylko na tej samej stronie przez HTTPS.");
  }
  return { origin: parsed.origin, rpID: parsed.hostname };
}

async function teacherAuth(req, res) {
  const expected = process.env.EDUKOT_TEACHER_PIN;
  if (!expected) {
    send(res, 503, { error: "Brakuje EDUKOT_TEACHER_PIN w Vercel → Settings → Environment Variables." });
    return false;
  }
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const limitKey = "edukot:passkey:pin-attempts:" + hash(ip);
  const attempts = Number(await redis(["GET", limitKey])) || 0;
  if (attempts >= 10) {
    send(res, 429, { error: "Za dużo prób. Spróbuj ponownie za 15 minut." });
    return false;
  }
  const supplied = String(req.headers["x-teacher-pin"] || "");
  const a = Buffer.from(hash(supplied));
  const b = Buffer.from(hash(expected));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const next = await redis(["INCR", limitKey]);
    if (Number(next) === 1) await redis(["EXPIRE", limitKey, 900]);
    send(res, 401, { error: "Nieprawidłowy PIN nauczyciela." });
    return false;
  }
  return true;
}

async function credentials() {
  const raw = await redis(["GET", CREDENTIALS_KEY]);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    throw new Error("Dane Passkey w bazie są uszkodzone.");
  }
}

function flowId() {
  return randomBytes(24).toString("hex");
}

async function saveChallenge(id, data) {
  await redis(["SET", "edukot:passkey:challenge:" + id, JSON.stringify(data), "EX", CHALLENGE_TTL]);
}

async function takeChallenge(id, kind) {
  if (!/^[a-f0-9]{48}$/.test(id)) return null;
  const key = "edukot:passkey:challenge:" + id;
  const raw = await redis(["GET", key]);
  await redis(["DEL", key]);
  if (!raw) return null;
  const data = JSON.parse(raw);
  return data.kind === kind ? data : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Niedozwolona metoda." });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return send(res, 400, { error: "Nieprawidłowe dane." }); }
  }
  const action = String(req.query?.action || body.action || "");

  try {
    if (action === "status" && req.method === "GET") {
      const list = await credentials();
      return send(res, 200, { registered: list.length > 0 });
    }

    if (action === "register-options" && req.method === "POST") {
      const { origin, rpID } = requestOrigin(req);
      const list = await credentials();
      if (list.length) return send(res, 409, { error: "Passkey jest już dodany. Usuń go przed dodaniem nowego." });
      const options = await generateRegistrationOptions({
        rpName: "EduKot",
        rpID,
        userID: new Uint8Array(createHash("sha256").update("edukot-teacher-account").digest()),
        userName: "nauczyciel-edukot",
        userDisplayName: "Nauczyciel EduKota",
        attestationType: "none",
        excludeCredentials: list.map((item) => ({ id: item.id, transports: item.transports || [] })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      });
      const id = flowId();
      await saveChallenge(id, { kind: "register", challenge: options.challenge, origin, rpID });
      return send(res, 200, { flowId: id, options });
    }

    if (action === "register-verify" && req.method === "POST") {
      const saved = await takeChallenge(String(body.flowId || ""), "register");
      if (!saved) return send(res, 400, { error: "Rejestracja wygasła. Spróbuj ponownie." });
      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: saved.challenge,
        expectedOrigin: saved.origin,
        expectedRPID: saved.rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return send(res, 400, { error: "Nie udało się potwierdzić Passkey." });
      }
      const credential = verification.registrationInfo.credential;
      const list = await credentials();
      if (list.some((item) => item.id === credential.id)) {
        return send(res, 409, { error: "Ten Passkey jest już dodany." });
      }
      list.push({
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports || [],
        createdAt: Date.now(),
      });
      await redis(["SET", CREDENTIALS_KEY, JSON.stringify(list)]);
      return send(res, 200, { ok: true });
    }

    if (action === "login-options" && req.method === "POST") {
      const { origin, rpID } = requestOrigin(req);
      const list = await credentials();
      if (!list.length) return send(res, 404, { error: "Nie dodano jeszcze Passkey." });
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: list.map((item) => ({ id: item.id, transports: item.transports || [] })),
        userVerification: "required",
      });
      const id = flowId();
      await saveChallenge(id, { kind: "login", challenge: options.challenge, origin, rpID });
      return send(res, 200, { flowId: id, options });
    }

    if (action === "login-verify" && req.method === "POST") {
      const saved = await takeChallenge(String(body.flowId || ""), "login");
      if (!saved) return send(res, 400, { error: "Logowanie wygasło. Spróbuj ponownie." });
      const list = await credentials();
      const stored = list.find((item) => item.id === String(body.response?.id || ""));
      if (!stored) return send(res, 401, { error: "Nie rozpoznano tego Passkey." });
      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: saved.challenge,
        expectedOrigin: saved.origin,
        expectedRPID: saved.rpID,
        credential: {
          id: stored.id,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
          counter: stored.counter,
          transports: stored.transports || [],
        },
        requireUserVerification: true,
      });
      if (!verification.verified) return send(res, 401, { error: "Nie udało się potwierdzić Passkey." });
      stored.counter = verification.authenticationInfo.newCounter;
      await redis(["SET", CREDENTIALS_KEY, JSON.stringify(list)]);
      return send(res, 200, { ok: true });
    }

    if (action === "remove" && req.method === "POST") {
      if (!(await teacherAuth(req, res))) return;
      await redis(["DEL", CREDENTIALS_KEY]);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "Nieznana akcja Passkey." });
  } catch (error) {
    const message = error?.message || "Błąd obsługi Passkey.";
    return send(res, 400, { error: message.slice(0, 220) });
  }
}
