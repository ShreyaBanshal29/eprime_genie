import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/models/database';
import { apiGet } from '@/utils/api';

export async function POST(req: Request) {
  try {
    const authorizationHeader = req.headers.get('Authorization');
    const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Authorization token missing' }, { status: 401 });
    }

    const userData = await apiGet(`verify-token/${token}/`);
    console.log('User data from token verification:', userData);
    const { id: studentId, name, role } = userData;

    if (!studentId || !name) {
      return NextResponse.json({ success: false, message: 'Invalid user data from token' }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    const apiBase = (process.env.NEXT_PUBLIC_EXTERNAL_API_BASE || process.env.AUTH_API_URL || '').replace(/\/$/, '');
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN || process.env.API_TOKEN || process.env.X_API_TOKEN;

    const fetchJson = async (url: string) => {
      try {
        const r = await fetch(url, { cache: 'no-store', headers: apiToken ? { 'X-API-TOKEN': apiToken } : undefined });
        if (!r.ok) return undefined;
        return await r.json();
      } catch {
        return undefined;
      }
    };

    const [profile, attendance, assignments, examlist, enrollment, scores] = await Promise.all([
      fetchJson(`${apiBase}/students/${studentId}`),
      fetchJson(`${apiBase}/student/attendance/summary/monthly/${studentId}/`),
      fetchJson(`${apiBase}/student/assignments/${studentId}/`),
      fetchJson(`${apiBase}/student/ExamList/${studentId}/`),
      fetchJson(`${apiBase}/students/enrollment/`),
      fetchJson(`${apiBase}/student/ExamData/${studentId}/`),
    ]);

    await db.upsertStudent({
      studentId,
      name,
      lastLogin: new Date(),
      profile,
      attendance,
      enrollment,
      scores,
      assignments,
      examlist,
    });

    return NextResponse.json({ success: true, user: { studentId, name, role } });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
