import axios from "axios";
import { MongoClient } from "mongodb";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const MONGODB_URI = process.env.MONGODB_URI!;
const AUTH_API_URL = process.env.AUTH_API_URL!;
const API_TOKEN = process.env.API_TOKEN!;

const chat = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash",
});

type StudentData = {
  profile?: unknown;
  attendance?: unknown;
  enrollment?: unknown;
  scores?: unknown;
  score?: unknown;
  assignments?: unknown;
  examlist?: unknown;
};

export async function fetchAndSaveStudent(studentId: string) {
  // Fetch data from API
  const response = await axios.get(`${AUTH_API_URL}${studentId}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  const studentData: StudentData = response.data;

  // Save to MongoDB
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("studentdb");
  const collection = db.collection("students");
  await collection.updateOne(
    { studentId },
    { $set: { ...studentData, studentId } },
    { upsert: true }
  );
  await client.close();
  return studentData;
}

export async function getStudentData(studentId: string): Promise<StudentData | null> {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("studentdb");
  const collection = db.collection("students");
  const student = await collection.findOne({ studentId });
  await client.close();
  return student as StudentData;
}

export async function askGeminiAboutStudent(studentId: string, question: string) {
  const data = await getStudentData(studentId);
  if (!data) return "Student not found.";

  const prompt = `
    Student Info: ${JSON.stringify(data)}
  Question: ${question}
    Answer:
  `;
  const response = await chat.call([
    {
      content: prompt,
      type: "human",
    },
  ]);
  return response;
}
