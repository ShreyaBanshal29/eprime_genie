// app/api/history/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/models/mongodb";
import { DatabaseService } from "@/lib/models/database";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("id");

    if (!studentId) {
      return NextResponse.json({ success: false, message: "Missing student ID" }, { status: 400 });
    }

    const db = DatabaseService.getInstance();
    const conversations = await db.getConversationsByStudent(studentId);

    // Normalize shape: ensure a preview title and a date field
    const normalized = conversations
      .map((c: any, index: number) => ({
        _id: c._id,
        id: String(c._id ?? index + 1),
        title: (c.title && String(c.title).trim()) || (c.messages?.[0]?.text?.slice(0, 40) ?? `Conversation ${index + 1}`),
        updatedAt: c.updatedAt ?? c.createdAt ?? new Date(0),
        createdAt: c.createdAt ?? c.updatedAt ?? new Date(0),
        sessionId: c.sessionId,
        messages: c.messages ?? [],
        date: c.updatedAt ?? c.createdAt ?? new Date(0),
      }))
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ success: true, conversations: normalized });
  } catch (error) {
    console.error("❌ Error fetching history:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { studentId, title, messages } = body;

    if (!studentId || !messages) {
      return NextResponse.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("studentdb");

    // Use the first user message as title if no title provided
    const generatedTitle =
      title ||
      (messages.find((m: any) => m.role === "user")?.text?.slice(0, 30) ?? "Untitled Chat");

    const newConversation = {
      studentId,
      title: generatedTitle,
      messages,
      date: new Date().toISOString(),
    };

    await db.collection("conversations").insertOne(newConversation);

    return NextResponse.json({ success: true, conversation: newConversation });
  } catch (error) {
    console.error("❌ Error saving conversation:", error);
    return NextResponse.json({ success: false, message: "Failed to save conversation" }, { status: 500 });
  }
}
