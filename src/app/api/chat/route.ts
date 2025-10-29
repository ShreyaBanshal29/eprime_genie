// app/api/chat/route.ts

import { NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '@/lib/models/database';


/**
 * Utility: Format Gemini response into clean paragraphs without markdown.
 */
function formatGeminiResponse(text: string): string {
  if (!text) return "<p> No response received. </p>";

  let formatted = text;

  // Remove markdown formatting
  formatted = formatted
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/#{1,6}\s?/g, "")
    .replace(/_{1,2}/g, "")
    .replace(/~~/g, "")
    .replace(/`(.*?)`/g, "<code>$1</code>");

  // Handle code blocks with indentation
  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, __, code) => {
    return `    ${code.trim().replace(/\n/g, "\n    ")}`;
  });

  // Convert lists
  formatted = formatted
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, (m) => `${m.trim()} `);

  // Emojis for key phrases
  const emojiMap: { [key: string]: string } = {
    "important:|crucial:|key point": "🔑",
    "tip:|suggestion:|recommendation": "💡",
    "warning:|caution:|attention": "⚠️",
    "note:|notice": "📝",
    "example:|for example:|e.g.": "📌",
    "advantage:|benefit:|pro": "✅",
    "disadvantage:|limitation:|con": "❌",
    "question:|how to|what is": "❓",
    "success:|achievement:|completed": "🎯",
    "error:|problem:|issue": "❌",
    "info:|information": "ℹ️",
  };

  Object.entries(emojiMap).forEach(([patterns, emoji]) => {
    patterns.split("|").forEach((pattern) => {
      const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
      formatted = formatted.replace(regex, `${emoji} $1`);
    });
  });

  // Ensure paragraph breaks
  formatted = formatted.replace(/(\n\s*)\n\s*/g, "\n\n");

  // Clean up paragraphs
  const paragraphs = formatted
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p, index) => {
      // Capitalize the first letter, but only if it's a letter
      if (p.match(/^[a-z]/)) {
        p = p.charAt(0).toUpperCase() + p.slice(1);
      }
      // Don't indent the first paragraph or list items
      const isListItem = p.startsWith("•") || /^\d+\.\s/.test(p);
      const shouldIndent = index > 0 && !isListItem;
      const className = shouldIndent ? 'class="indent-8"' : "";
      return `<p ${className}>${p}</p>`;
    })
    .join(""); // Join into a single HTML string
}


/**
 * Utility: Extract plain text from Gemini response
 */
type GeminiResponse = {
  content?:
  | string
  | { text?: string } & Record<string, unknown>
  | Array<{ type?: string; text?: string }>;
};

function extractReplyText(response: GeminiResponse): string {
  if (Array.isArray(response.content)) {
    const textPart = response.content.find(
      (c) => c.type === "text" && typeof c.text === "string"
    );
    return textPart?.text ?? "";
  } else if (typeof response.content === "string") {
    return response.content;
  } else if (
    response.content &&
    typeof response.content === "object" &&
    typeof (response.content as { text?: string }).text === "string"
  ) {
    return (response.content as { text: string }).text;
  }
  return "⚠️ No response from Gemini.";
}

/**
 * Utility: Read Excel files and convert to JSON
 */
function readExcelFiles(): string {
  try {
    // Read from public directory using readFileSync
    const dataDir = join(process.cwd(), 'public');
    const files = ['3103.xlsx', 'Expense Code Mapping Logic.xlsx'];
    const allData: Record<string, unknown> = {};

    console.log('Attempting to read Excel files from:', dataDir);

    files.forEach(fileName => {
      try {
        const filePath = join(dataDir, fileName);
        console.log('Reading file:', filePath);

        // Check if file exists
        const fs = require('fs') as typeof import('fs');
        if (!fs.existsSync(filePath)) {
          console.error(`File does not exist: ${filePath}`);
          allData[fileName] = { error: `File not found: ${fileName}` } as unknown;
          return;
        }

        // Read file as buffer first, then parse
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Convert all sheets to JSON and limit size to avoid huge payloads
        const sheetData = {} as Record<string, unknown>;
        const MAX_ROWS = 50; // Reduced from 200
        const MAX_COLS = 10; // Reduced from 30
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[] as any[][];
          const limited = jsonData.slice(0, MAX_ROWS).map(row => (Array.isArray(row) ? row.slice(0, MAX_COLS) : row));
          sheetData[sheetName] = limited;
        });

        allData[fileName] = sheetData;
        console.log(`Successfully read ${fileName} with ${workbook.SheetNames.length} sheets`);
      } catch (error) {
        const msg = (error as Error)?.message || String(error);
        console.error(`Error reading ${fileName}:`, msg);
        allData[fileName] = { error: `Failed to read ${fileName}: ${msg}` } as unknown;
      }
    });

    // Stringify and hard-limit payload to avoid huge prompts
    const json = JSON.stringify(allData, null, 2);
    const MAX_CONTEXT_CHARS = 50_000; // ~50 KB of text (reduced from 200KB)
    return json.length > MAX_CONTEXT_CHARS ? json.slice(0, MAX_CONTEXT_CHARS) + "\n... [truncated]" : json;
  } catch (error) {
    const msg = (error as Error)?.message || String(error);
    console.error('Error reading Excel files:', msg);
    return JSON.stringify({ error: 'Failed to read Excel files', details: msg });
  }
}

// Helper: timeout wrapper so requests don't hang forever
async function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

/**
 * Minimal DatabaseService stub
 * Replace with your actual implementation
 */
// Removed database usage to avoid requiring MongoDB during chat

/**
 * POST handler: Handles chat requests
 */
export async function POST(req: Request) {
  try {
    console.log('Chat API called');
    const body = await req.json();
    const { message, id, studentId, sessionId, messages } = body;

    if (!message) {
      return NextResponse.json(
        { reply: "⚠️ Message is required." },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not found');
      return NextResponse.json(
        { reply: "⚠️ Server configuration error." },
        { status: 500 }
      );
    }

    console.log('Reading Excel files...');

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GOOGLE_API_KEY!,
    });

    let replyText = "";

    // Read Excel files data
    let excelData;
    try {
      excelData = readExcelFiles();
      console.log('Excel data read successfully, length:', excelData.length);
    } catch (error) {
      console.error('Error reading Excel files:', error);
      excelData = JSON.stringify({ error: 'Failed to read Excel files' });
    }

    // Single flow: always answer using Excel data context
    const response = await withTimeout(
      model.invoke(
        `
  You are a Senior Business Analyst.
  Your expertise lies in analyzing business data, identifying trends, patterns, and providing actionable insights to drive business decisions.
  
  Your capabilities include:
  1. Data analysis and interpretation from Excel files and datasets
  2. Financial analysis and KPI evaluation
  3. Market trend analysis and forecasting
  4. Business process optimization recommendations
  5. Risk assessment and mitigation strategies
  6. Performance metrics and dashboard insights
  
  Rules:
  1. Always respond as a professional business analyst with deep analytical expertise.
  2. Never reveal that you are an AI, Gemini, or that data is being sent to you.
  3. Use the provided business data silently — analyze it thoroughly and provide insights.
  4. Be precise, data-driven, and provide actionable recommendations.
  5. Only provide the final summarized answer — do not include any explanations, reasoning steps, or process details.
  6. Always consider business implications and ROI in your analysis.

         Available Data Context: ${excelData}

         User Question: ${message}`
      ),
      360000, // Increased timeout to 60 seconds
      'Gemini response'
    );
    replyText = extractReplyText(response);

    const formattedReply = formatGeminiResponse(replyText);

    // Persist conversation if identifiers provided
    try {
      const db = DatabaseService.getInstance();
      const sid = (studentId || id) as string | undefined;
      if (sid && sessionId && Array.isArray(messages)) {
        const updatedMessages = [
          ...messages,
          { role: 'user', text: message },
          { role: 'ai', text: formattedReply },
        ];
        await db.saveConversation(sid, sessionId, updatedMessages);
        await db.incrementMessageCount(sessionId);
      }
    } catch (e) {
      console.warn('Failed to persist conversation:', e);
    }

    return NextResponse.json({ reply: formattedReply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gemini API error:", message);
    return NextResponse.json({ reply: `⚠️ Error: ${message}` }, { status: 500 });
  }
}

/**
 * GET handler: Fetch users
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}