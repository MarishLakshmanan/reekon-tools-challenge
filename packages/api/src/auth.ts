import { randomBytes } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import type { Db } from './db';
import { verifyPassword } from './password';

declare global {
  namespace Express {
    interface Request {
      userId: number;
      token: string;
    }
  }
}

export function requireUser(db: Db) {
  const findSession = db.prepare('SELECT user_id FROM sessions WHERE token = ?');
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.get('authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '');
    const session = token ? (findSession.get(token) as { user_id: number } | undefined) : undefined;
    if (!session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = session.user_id;
    req.token = token;
    next();
  };
}

export function loginRouter(db: Db) {
  const findUser = db.prepare('SELECT id, name, password_hash FROM users WHERE username = ?');
  const insertSession = db.prepare(
    'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)',
  );
  const router = Router();

  router.post('/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }
    const user = findUser.get(username) as
      { id: number; name: string; password_hash: string } | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    const token = randomBytes(32).toString('base64url');
    insertSession.run(token, user.id, Date.now());
    res.json({ token, user: { id: user.id, name: user.name } });
  });

  return router;
}

export function logout(db: Db) {
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
  return (req: Request, res: Response) => {
    deleteSession.run(req.token);
    res.json({ ok: true });
  };
}
