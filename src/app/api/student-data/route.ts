// app/api/student-data/route.ts (Updated Content)

import { NextResponse } from 'next/server';
// Assuming your helper function is in lib/utils/studentData.ts or similar
import { fetchStudentData } from '@/lib/models/studentData'; // Adjust path if necessary 

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('id'); // e.g., '12'

    // ⚠️ CRITICAL: Replace this simple check with secure session/cookie validation
    if (!studentId) {
      return NextResponse.json({ success: false, message: 'Student ID missing (Authentication required)' }, { status: 401 });
    }
    
    // 1. Fetch ALL student data using your existing helper function
    const studentData = await fetchStudentData(studentId);

    // 2. Extract the Name from the fetched profile data
    // Assuming the 'profile' object contains 'name' or 'fullName'
    const profile = studentData.profile as any; // Cast to 'any' for quick property access

    // Choose the name field that works for your external API response
    const studentName = profile.name || profile.fullName || `${profile.firstName} ${profile.lastName}` || 'Student';

    // 3. Check for a valid name/ID and return
    if (studentName === 'Student' || !studentId) {
       return NextResponse.json({ success: false, message: 'Could not resolve student name from profile' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      studentInfo: {
        studentId: studentId,
        studentName: studentName, // The full name is needed for the AI login POST
      }
    });
    
  } catch (error) {
    console.error('Error fetching student data for auto-login:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error fetching student data' },
      { status: 500 }
    );
  }
}