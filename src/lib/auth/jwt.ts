import jwt from "jsonwebtoken"

const SECRET: jwt.Secret = process.env.JWT_SECRET!
const EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN) || 10800 // default 3 hours in seconds

interface TokenPayload {
  sub: string // actor ID
}

export function signToken(actorId: string): string {
  return jwt.sign({ sub: actorId }, SECRET, { algorithm: "HS256", expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as TokenPayload
}
