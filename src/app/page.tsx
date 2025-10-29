"use client";

import { useState, useEffect, useRef } from "react"; // ADDED useRef
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
// ADDED FiMic and FiSquare for mic control, FiFile for file display
import { FiSend, FiPaperclip, FiClock, FiX, FiMic, FiSquare, FiFile } from "react-icons/fi";


type Message = { role: "user" | "ai"; text: string };
type HistoryItem = { id: string; title: string; messages: Message[]; conversationId?: string; date?: string | Date };

// --- ⬇️ START HOME COMPONENT ⬇️ ---
export default function Home() {
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; id?: string }>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSliding] = useState(false);
  const [timer, setTimer] = useState(900);
  const [sessionActive, setSessionActive] = useState(true);
  const [, setSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Used original state for loading/disabling buttons
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // --- ⬇️ NEW STATE & REFS ⬇️ ---
  const endRef = useRef<HTMLDivElement>(null); // For auto-scrolling
  const fileInputRef = useRef<HTMLInputElement>(null); // For file dialog trigger
  const recognitionRef = useRef<any>(null); // For speech recognition instance

  const [isRecording, setIsRecording] = useState(false); // Track mic state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]); // Store selected files
  const [isDragOver, setIsDragOver] = useState(false); // For drag-and-drop visual feedback
  // --- ⬆️ END NEW STATE & REFS ⬆️ ---


  // ✅ Validation (Used only if auto-login fails and manual form is visible)
  const validate = () => {
    const newErrors: { name?: string; id?: string } = {};
    // Accept at least two words for name and numeric-only student id
    const namePattern = /^\s*\S+(?:\s+\S+)+\s*$/; // at least two words
    if (!namePattern.test(String(studentName).trim())) {
      newErrors.name = "Enter first and last name.";
    }
    const idPattern = /^\d+$/; // one or more digits
    if (!idPattern.test(String(studentId).trim())) {
      newErrors.id = "ID must be numeric.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  type AuthSuccess = {
    success: true;
    sessionId: string;
    student: { studentId: string; name: string; lastLogin: string };
  };
  type AuthFailure = { success: false; message: string };

  // ✅ REFACTORED LOGIN: Handles the final POST request to your AI backend (/api/auth)
  const handleCounsellorAiLogin = async (id: string, name: string) => {
    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          name: name.trim(),
        }),
      });

      const data: AuthSuccess | AuthFailure = await response.json();

      if (data.success) {
        setStudentId(id);
        setStudentName(name);
        setIsAuthenticated(true);
        setSessionActive(true);
        setTimer(900);
        setSessionId(data.sessionId);

        await loadConversationHistory(id);

        if (window.history.replaceState) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
        }
      } else {
        setErrors({ name: data.message });
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("AI Login error:", error);
      setErrors({ name: "Failed to connect to AI system." });
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Removed token-based auto-login; manual login only


  // NOTE: Updated loadConversationHistory to accept ID, primarily for safety
  const loadConversationHistory = async (id: string) => {
    const fetchId = id || studentId; // Use provided ID or state ID
    if (!fetchId) return;

    try {
      const response = await fetch(`/api/history?id=${fetchId}&limit=10`);
      const data = await response.json();
      if (data.success && Array.isArray(data.conversations)) {
        const formattedHistory = data.conversations.map((conv: any, index: number) => ({
          id: conv._id ?? conv.id ?? String(index + 1),
          title: (conv.title && conv.title.trim())
            || (conv.messages?.[0]?.text?.slice(0, 40)
              ?? `Conversation ${index + 1}`),
          messages: (conv.messages ?? []).map((m: any) => ({ role: m.role, text: String(m.text || "") })),
          conversationId: conv.sessionId ?? conv.id,
          date: conv.updatedAt || new Date().toISOString(),
        }));
        setHistory(formattedHistory);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error("Error loading conversation history:", error);
      setHistory([]);
    }
  };

  // ✅ Handle Send Message (UPDATED)
  const handleSend = async () => {
    // Disable send if no input AND no files, or if session inactive
    if ((!input.trim() && uploadedFiles.length === 0) || !sessionActive) return;

    // Use input or indicate file attachment
    const messageText = input || `Attached ${uploadedFiles.length} file(s)`;
    setMessages((prev) => [...prev, { role: "user", text: messageText }]);
    const userMessage = input;

    // Clear input and files after preparing the message
    setInput("");
    setUploadedFiles([]); // <-- CLEARS FILES

    // ... (identityCheck logic remains the same) ...
    if (["hey chatgpt", "are you", "are you google", "are you gemini", "are you openai", "which llm", "what model", "are you chatgpt", "are you grok", "who made you", "who created you", "your developer", "your creator", "your name", "identify yourself", "who are you", "what are you", "your purpose", "are you a counsellor"].some((phrase) => userMessage.toLowerCase().includes(phrase))) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "I am Counsellor AI, created to support and guide you. I am not Google, Gemini, or OpenAI — I am your personal counsellor 🤝.",
        },
      ]);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          id: studentId.trim(),
          sessionId,
          messages,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "⚠️ Failed to connect to AI." }]);
    }
  };


  // --- ⬇️ NEW HELPER FUNCTIONS ⬇️ ---

  // ✅ Chat Management: Function to start a new chat
  const handleNewChat = () => {
    setMessages([]); // Clear messages
    setInput(""); // Clear input field
    setUploadedFiles([]); // Clear any selected files
    setTimer(900); // Reset timer
    setSessionActive(true);
  };
  const startNewSession = handleNewChat; // Alias the function

  // ✅ Speech Recognition: Start listening
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      alert(`Speech recognition error: ${event.error}`);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // ✅ Speech Recognition: Stop listening
  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  // ✅ File Handling: Process selected files (validation)
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const allowedTypes = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png'];
    const MAX_SIZE_MB = 10;

    const validFiles = fileArray.filter(file => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`File "${file.name}" exceeds ${MAX_SIZE_MB}MB.`);
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        alert(`Unsupported file type: "${file.type}".`);
        return false;
      }
      return true;
    });

    setUploadedFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const newFiles = validFiles.filter(f => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
  };

  // ✅ File Handling: Triggered when file input changes
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    if (e.target) e.target.value = '';
  };

  // ✅ File Handling: Drag and Drop events
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // ✅ File Handling: Remove a selected file by name
  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(file => file.name !== fileName));
  };

  // ✅ File Handling: Programmatically click the hidden file input
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };
  // --- ⬆️ END NEW HELPER FUNCTIONS ⬆️ ---


  // --- ⬇️ NEW USEEFFECT HOOKS ⬇️ ---
  // ✅ Auto-scroll chat to the bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ Cleanup speech recognition instance when component unmounts
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);
  // --- ⬆️ END NEW USEEFFECT HOOKS ⬆️ ---


  // Manual login flow only; no auto login


  // ✅ Timer Countdown (Logic remains the same)
  useEffect(() => {
    if (!isAuthenticated || !sessionActive) return;
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t > 0) return t - 1;
        clearInterval(interval);
        setSessionActive(false);
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "⏳ Session expired. Please start a new chat." },
        ]);
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, sessionActive]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const loadHistory = (item: HistoryItem) => {
    setMessages(item.messages);
    setSidebarOpen(false);
  };

  // ------------------------------------------------
  // ---------- CONDITIONAL RENDERING ----------
  // ------------------------------------------------

  // 1. Show Loading while the initial fetch is happening
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-100">
        <h1 className="text-2xl font-semibold text-indigo-700">
          <FiClock className="inline mr-2 animate-spin" />
          Logging you in...
        </h1>
      </div>
    );
  }


  // 2. Show Manual Login Form only if auto-login failed (isAuthenticated is false)
  if (!isAuthenticated) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-100 overflow-hidden">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1 }}
          className="absolute top-10 left-10 w-40 h-40 bg-indigo-200 rounded-full opacity-30"
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute bottom-10 right-10 w-56 h-56 bg-purple-200 rounded-full opacity-30"
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-700 drop-shadow-md">
            Welcome to <span className="text-purple-600">Thalema AI</span>
          </h1>
          <p className="mt-3 text-gray-600 max-w-md">
            Please enter your credentials to continue.
            This ensures a secure and personalized chat session.
          </p>
          <div className="mt-8 bg-white shadow-2xl rounded-2xl p-8 w-96">
            <h2 className="text-xl font-semibold mb-6 text-indigo-700">
              🔐 Enter Credentials
            </h2>
            <input
              type="text"
              placeholder="Student Name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className={`w-full border rounded-lg p-3 mb-2 focus:ring-2 focus:ring-indigo-500 ${errors.name ? "border-red-500" : "border-gray-300"
                }`}
            />
            {errors.name && <p className="text-red-500 text-sm mb-3">{errors.name}</p>}
            <input
              type="text"
              placeholder="ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={`w-full border rounded-lg p-3 mb-2 focus:ring-2 focus:ring-indigo-500 ${errors.id ? "border-red-500" : "border-gray-300"
                }`}
            />
            {errors.id && <p className="text-red-500 text-sm mb-3">{errors.id}</p>}
            <button
              onClick={async () => { if (validate()) await handleCounsellorAiLogin(studentId, studentName); }}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Show Chat Page when isAuthenticated is true
  // ---------- CHAT PAGE ----------
  return (
    <div
      className="flex min-h-screen bg-cover bg-bottom bg-fixed"
      style={{ backgroundImage: "url('/bg.png')" }}
    >

      {/* ===== Floating History Button + new chat ===== */}
      <button
        onClick={() => setIsHistoryOpen(true)}
        className="fixed top-3 left-5 z-50 bg-indigo-800 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-800 transition-all duration-200 flex items-center gap-2"
      >
        <FiClock size={18} />
        <span className="font-medium">History</span>
      </button>

      <button
        onClick={handleNewChat}
        className="fixed top-3 left-[9.5rem] z-50 bg-indigo-800 text-white px-4 py-2 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-200 flex items-center gap-2"
        title="Start a New Chat"
      >
        <span className="font-medium">New Chat</span>
      </button>
      {/* ===== Drawer Animation (Existing) ===== */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
            />

            {/* Drawer Panel */}
            <motion.div
              className="fixed top-0 left-0 z-50 bg-white shadow-2xl h-full w-[350px] rounded-r-2xl flex flex-col"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-blue-900 flex items-center gap-2">
                  <FiClock /> Chat History
                </h2>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                {history.length === 0 ? (
                  <p className="text-gray-500 italic text-center">No conversation history found.</p>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        loadHistory(item);
                        setIsHistoryOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg transition-all duration-200"
                    >
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-indigo-800 truncate">{item.title}</p>
                        <span className="text-xs text-gray-400 ml-2">
                          {item.date ? new Date(item.date).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {item.messages?.[0]?.text?.slice(0, 80) || "No preview"}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* ===== Main Chat Area ===== */}
      <div className="flex-1 flex flex-col relative">
        {/* ===== Header ===== */}
        <header className="sticky top-0 z-20 bg-white/40 backdrop-blur-md border-gray-200 text-indigo-900 py-1 shadow-lg">
          <h1 className="text-center text-2xl font-bold tracking-wide bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            Thalema — Your Counsellor AI </h1>
          <p className="text-center text-1xl font-bold tracking-wide bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">Serving Will, Purpose and Desire</p>
        </header>

        {/* ===== Timer (fixed top-right) ===== */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [1, 0.9, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="fixed top-18 right-6 text-indigo-900 text-lg font-semibold bg-white/30 border-gray-300 backdrop-blur-sm px-4 py-1 rounded-full shadow-md border border-white/40"
        >
          {sessionActive ? formatTime(timer) : "Expired"}
        </motion.div>

        {/* ===== Messages (only scrollable section) ===== */}
        <div className="flex-1 overflow-y-auto px-1 py-1 space-y-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-50 space-y-1">
              <Image
                src="/counsellor.png"
                alt="Counsellor"
                width={400}
                height={400}
                className="rounded-3xl"
              />
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`my-2 flex ${m.role === "user" ? "justify-start" : "justify-end"} px-64`}
              >
                <div
                  className={`px-2 py-2 text-lg max-w-[70%] rounded-2xl whitespace-pre-wrap ${m.role === "user" ? "bg-gray-100 text-black" : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                    }`}
                  dangerouslySetInnerHTML={{ __html: m.text }}
                />
              </div>
            ))
          )}

          {/* --- ⬇️ SCROLL TARGET ⬇️ --- */}
          <div ref={endRef} />
          {/* --- ⬆️ SCROLL TARGET ⬆️ --- */}

        </div>

        {/* ===== Floating Counsellor Image ===== */}
        {messages.length > 0 && (
          <motion.div
            animate={{ x: isSliding ? 50 : 0 }}
            transition={{ type: "spring", stiffness: 50 }}
            className="fixed bottom-24 right-5 z-10"
          >
            <Image
              src="/counsellor.png"
              alt="Counsellor"
              width={250}
              height={250}
              className="rounded-full border-2 border-white/40 shadow-3xl shadow-blue-500/25"
            />
          </motion.div>
        )}

        {/* ===== Fixed Chat Input Bar (Composer) - REPLACEMENT JSX ===== */}
        <div className="sticky bottom-0 flex justify-center py-4 z-20">
          {!sessionActive ? (
            <button
              onClick={handleNewChat}
              className="px-8 py-4 rounded-lg bg-blue-600 text-white text-2xl hover:bg-blue-700"
            >
              🔄 Start New Session
            </button>
          ) : (
            // New composer with drag-drop, file preview, mic
            <div
              className={`flex flex-col w-[550px] max-w-[95%] border rounded-2xl bg-white shadow-sm transition-all duration-200 ${isDragOver ? 'border-indigo-500 border-2 ring-4 ring-indigo-200' : 'border-gray-300'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* File Upload Preview Area */}
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 w-full border-b border-gray-200 max-h-24 overflow-y-auto">
                  {uploadedFiles.map((file) => (
                    <div key={file.name} className="flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                      <FiFile className="mr-1 flex-shrink-0" />
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button
                        className="ml-1.5 text-xs font-bold leading-none hover:text-red-500"
                        onClick={() => removeFile(file.name)}
                        title="Remove file"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Input Row */}
              <div className="flex items-center w-full px-3 py-2">
                {/* Attach File Button */}
                <button
                  className="text-gray-500 hover:text-indigo-600 mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={openFileDialog}
                  disabled={isLoading || isRecording}
                  title="Attach File"
                >
                  <FiPaperclip size={20} />
                </button>

                {/* Mic Button - Uses FiMic and FiSquare */}
                <button
                  className={`mr-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isRecording
                      ? 'text-red-500 animate-pulse'
                      : 'text-gray-500 hover:text-indigo-600'
                    }`}
                  title={isRecording ? "Stop Recording" : "Start Voice Input"}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                >
                  {isRecording ? <FiSquare size={20} /> : <FiMic size={20} />}
                </button>

                {/* Input Field */}
                <input
                  type="text"
                  className="flex-1 border-none outline-none text-base px-2 bg-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder={
                    isLoading ? "Processing..."
                      : isRecording ? "Listening..."
                        : "Ask Counsellor AI..."
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isLoading || isRecording}
                />

                {/* Send Button */}
                <button
                  className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSend}
                  disabled={isLoading || (input.trim().length === 0 && uploadedFiles.length === 0)}
                  title="Send Message"
                >
                  <FiSend size={16} />
                </button>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                accept=".pdf,.txt,.jpg,.jpeg,.png"
              />
            </div>
          )}
        </div>
        {/* --- ⬆️ END FIXED CHAT INPUT BAR ⬆️ --- */}

      </div> {/* End Main Chat Area */}
    </div> // End Root Div
  );
}