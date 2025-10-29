"use client";

import { useState } from "react";

export default function CredentialPopup({ onSubmitAction }: { onSubmitAction: (name: string, id: string) => void }) {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [show, setShow] = useState(true);

  const handleSubmit = () => {
    if (!name.trim() || !studentId.trim()) return;
    onSubmitAction(name, studentId);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 bg-opacity-90 z-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-96 text-center">
        <h2 className="text-2xl font-bold mb-6 flex items-center justify-center">
          🔒 Enter Credentials
        </h2>

        <input
          type="text"
          placeholder="Student Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="text"
          placeholder="Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="w-full border p-3 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 w-full transition"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
