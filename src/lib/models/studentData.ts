export async function fetchStudentData(studentId: string) {
  // Helper to safely fetch JSON
  const safeJson = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.warn("Failed to fetch:", url, e);
      return {};
    }
  };

  // Example APIs (replace with your actual endpoints). Fixed missing slashes.
  const profile = await safeJson(`https://alnada.eprime.app/api/students/${studentId}`);
  const attendance = await safeJson(`https://alnada.eprime.app/api/student/attendance/summary/monthly/45/${studentId}`);
  const scores = await safeJson(`https://alnada.eprime.app/api/student/ExamData/45/17/${studentId}`);
  const enrollment = await safeJson(`https://alnada.eprime.app/api/students/enrollment/${studentId}`);
  const assignments = await safeJson(`https://alnada.eprime.app/api/student/assignments/40/${studentId}`);
  const examlist = await safeJson(`https://alnada.eprime.app/api/student/ExamList/45/${studentId}`);

  return {
    profile,
    attendance,
    enrollment,
    scores,
    assignments,
    examlist,
  };
}