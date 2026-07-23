import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import {
  listAuthSessions,
  revokeAuthSession,
  revokeAllAuthSessions,
  touchAuthSession,
} from '@/lib/authSessions';
import { SESSION_IDLE_MS, SESSION_MAX_MS } from '@/lib/authSecurity';

export const dynamic = 'force-dynamic';

async function requireUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    return await getAuth().verifyIdToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const decoded = await requireUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      await touchAuthSession(decoded.uid, sessionId);
    }

    const sessions = await listAuthSessions(decoded.uid);
    return NextResponse.json({
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        deviceLabel: s.deviceLabel,
        ip: s.ip,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        current: Boolean(s.current),
      })),
      idleMs: SESSION_IDLE_MS,
      maxMs: SESSION_MAX_MS,
    });
  } catch (error) {
    console.error('[auth/sessions GET]', error);
    return NextResponse.json({ error: 'Could not list sessions' }, { status: 500 });
  }
}

/** Revoke one session or all (logout all devices) */
export async function DELETE(request) {
  try {
    const decoded = await requireUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.all) {
      await revokeAllAuthSessions(decoded.uid, {
        exceptSessionId: body.keepCurrent ? body.sessionId : null,
      });
      return NextResponse.json({
        ok: true,
        message: 'All other sessions revoked. Refresh tokens invalidated.',
      });
    }

    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId or all required' }, { status: 400 });
    }

    await revokeAuthSession(decoded.uid, body.sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[auth/sessions DELETE]', error);
    return NextResponse.json({ error: 'Could not revoke session' }, { status: 500 });
  }
}

/** Heartbeat / extend lastSeen */
export async function POST(request) {
  try {
    const decoded = await requireUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }
    const session = await touchAuthSession(decoded.uid, body.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired or revoked', expired: true }, { status: 401 });
    }
    return NextResponse.json({ ok: true, lastSeenAt: session.lastSeenAt });
  } catch (error) {
    console.error('[auth/sessions POST]', error);
    return NextResponse.json({ error: 'Could not touch session' }, { status: 500 });
  }
}
