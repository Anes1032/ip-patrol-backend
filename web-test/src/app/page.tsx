"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import ResultDisplay from "@/components/ResultDisplay";

type TaskResult = {
  taskId: string;
  type: "register" | "verify";
  status: string;
  data?: Record<string, unknown>;
};

type TaskData = {
  taskId: string;
  status: string;
  [key: string]: unknown;
};

export default function Home() {
  const [results, setResults] = useState<TaskResult[]>([]);
  const [registeredVideoId, setRegisteredVideoId] = useState<string | null>(null);
  const [verifySessionId, setVerifySessionId] = useState<string | null>(null);

  const addResult = (result: TaskResult) => {
    setResults((prev) => [...prev, result]);
    if (result.type === "register" && result.data?.video_id) {
      setRegisteredVideoId(result.data.video_id as string);
    }
  };

  const updateResult = (data: TaskData) => {
    setResults((prev) =>
      prev.map((r) =>
        r.taskId === data.taskId ? { ...r, status: data.status, data } : r
      )
    );
    if (data.video_id) {
      setRegisteredVideoId(data.video_id as string);
    }
  };

  const handleSessionStarted = (sessionId: string) => {
    setVerifySessionId(sessionId);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            IP Patrol
          </h1>
          <p className="text-purple-300">Video Reprint Detection System</p>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Register Base Video</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Upload a video to extract fingerprints for comparison
            </p>
            {registeredVideoId ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-400 font-medium mb-2">Base video registered</p>
                <code className="text-xs text-gray-500 bg-black/30 px-2 py-1 rounded">{registeredVideoId}</code>
              </div>
            ) : (
              <UploadForm
                type="register"
                onTaskStarted={(taskId) => addResult({ taskId, type: "register", status: "processing" })}
                onResult={updateResult}
              />
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Verify Video</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Check if a video matches the registered base
            </p>
            {registeredVideoId ? (
              <UploadForm
                type="verify"
                baseVideoId={registeredVideoId}
                onTaskStarted={(taskId) => addResult({ taskId, type: "verify", status: "processing" })}
                onResult={updateResult}
                onSessionStarted={handleSessionStarted}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p>Register a base video first</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">Results</h2>
          <ResultDisplay results={results} sessionId={verifySessionId} />
        </div>
      </div>
    </div>
  );
}
