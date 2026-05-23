import { Router } from 'express';
import { z } from 'zod';
import { authenticateUser, getUserWithRoles, signAccessToken } from '../services/auth.js';
import { writeAudit } from '../middleware/audit.js';
import { requireAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await authenticateUser(body.email, body.password);
    const token = signAccessToken(user);
    await writeAudit({
      userId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      entity: 'auth',
      entityId: user.id,
      action: 'LOGIN',
    });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getUserWithRoles(req.user!.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
