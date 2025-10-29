import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/models/database';

export async function POST(req: Request) {
  try {
    const { id, studentId: legacyStudentId, name } = await req.json();
    const studentId = (id ?? legacyStudentId)?.toString();

    // Validate input
    if (!studentId || !name) {
      return NextResponse.json(
        { success: false, message: 'ID and name are required' },
        { status: 400 }
      );
    }

    // Validate student ID format (must be numeric)
    const idPattern = /^\d+$/;
    if (!idPattern.test(String(studentId).trim())) {
      return NextResponse.json(
        { success: false, message: 'ID must be numeric' },
        { status: 400 }
      );
    }

    // Validate name format (require at least two words, allow common name characters)
    const namePattern = /^\s*\S+(?:\s+\S+)+\s*$/; // at least two non-empty words
    if (!namePattern.test(String(name).trim())) {
      return NextResponse.json(
        { success: false, message: 'Enter first and last name (alphabets only)' },
        { status: 400 }
      );
    }

    const db = DatabaseService.getInstance();

    // Manual login: upsert minimal student profile without any token/external verification
    await db.upsertStudent({
      studentId,
      name,
      lastLogin: new Date(),
      profile: undefined,
      attendance: undefined,
      enrollment: undefined,
      scores: undefined,
      assignments: undefined,
      examlist: undefined,
    });

    // Create a new chat session
    const sessionId = await db.createChatSession(studentId);

    return NextResponse.json({
      success: true,
      student: {
        studentId,
        name,
        lastLogin: new Date().toISOString()
      },
      sessionId
    });

  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = (searchParams.get('id') ?? searchParams.get('studentId')) ?? undefined as unknown as string;

    if (!studentId) {
      return NextResponse.json(
        { success: false, message: 'ID is required' },
        { status: 400 }
      );
    }

    const db = DatabaseService.getInstance();
    const student = await db.getStudentById(studentId);

    console.log('Fetched student:', student);

    if (!student) {
      return NextResponse.json(
        { success: false, message: 'Student not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student: {
        studentId: student.studentId,
        name: student.name,
        lastLogin: student.lastLogin,
        profile: student.profile
      }
    });

  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
