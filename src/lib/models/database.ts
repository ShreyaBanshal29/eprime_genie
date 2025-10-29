// lib/models/DatabaseService.ts
import clientPromise from "./mongodb";

export class DatabaseService {
  private static instance: DatabaseService;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ✅ Fetch student by ID
  async getStudentById(studentId: string) {
    const client = await clientPromise;
    return client.db("studentdb").collection("students").findOne({ studentId });
  }

  // ✅ Save conversation history (auto-generate title if missing)
  async saveConversation(
    studentId: string,
    sessionId: string,
    messages: { role: string; text: string }[],
    title?: string
  ) {
    const client = await clientPromise;

    // Pick first user message as title if no title given
    const generatedTitle =
      title ||
      messages.find((m) => m.role === "user")?.text?.slice(0, 40) ||
      "Untitled Conversation";

    await client.db("studentdb").collection("conversations").updateOne(
      { studentId, sessionId },
      {
        $set: {
          studentId,
          sessionId,
          title: generatedTitle, // ✅ Title added for sidebar display
          messages,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  // ✅ Increment message count
  async incrementMessageCount(sessionId: string) {
    const client = await clientPromise;
    await client
      .db("studentdb")
      .collection("sessions")
      .updateOne(
        { sessionId },
        {
          $inc: { messageCount: 1 },
          $set: { updatedAt: new Date() },
        },
        { upsert: true }
      );
  }

  // ✅ Create new chat session
  async createChatSession(studentId: string): Promise<string> {
    const client = await clientPromise;
    const newSession = {
      studentId,
      sessionId: crypto.randomUUID(),
      createdAt: new Date(),
      messageCount: 0,
    };
    await client.db("studentdb").collection("sessions").insertOne(newSession);
    return newSession.sessionId;
  }

  // ✅ Save or update student profile
  async upsertStudent(student: {
    studentId: string;
    name: string;
    lastLogin?: Date;
    profile?: unknown;
    attendance?: unknown;
    enrollment?: unknown;
    scores?: unknown;
    assignments?: unknown;
    examlist?: unknown;
  }) {
    const client = await clientPromise;
    const now = new Date();
    await client
      .db("studentdb")
      .collection("students")
      .updateOne(
        { studentId: student.studentId },
        {
          $set: {
            name: student.name,
            lastLogin: student.lastLogin ?? now,
            profile: student.profile,
            attendance: student.attendance,
            enrollment: student.enrollment,
            scores: student.scores,
            assignments: student.assignments,
            examlist: student.examlist,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
  }

  // ✅ Fetch conversation history for sidebar
  async getConversationsByStudent(studentId: string) {
    const client = await clientPromise;

    // Return full messages so clicking a history item can restore the chat
    return client
      .db("studentdb")
      .collection("conversations")
      .find({ studentId })
      .project({
        _id: 1,
        title: 1,
        updatedAt: 1,
        createdAt: 1,
        sessionId: 1,
        messages: 1,
      })
      .sort({ updatedAt: -1 })
      .toArray();
  }
}
