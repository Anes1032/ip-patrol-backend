"use client";

import { useState, useCallback } from "react";
import ProjectSelector from "@/components/ProjectSelector";
import AsyncUploader from "@/components/AsyncUploader";
import JobList from "@/components/JobList";

type View = "selector" | "project";

export default function Home() {
  const [view, setView] = useState<View>("selector");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelect = useCallback((videoId: string) => {
    setSelectedVideoId(videoId);
    setView("project");
  }, []);

  const handleCreate = useCallback(() => {
    const newVideoId = crypto.randomUUID();
    setSelectedVideoId(newVideoId);
    setView("project");
  }, []);

  const handleBack = useCallback(() => {
    setView("selector");
    setSelectedVideoId(null);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">IP Patrol</h1>
          <p className="text-purple-300">Video Reprint Detection System</p>
        </header>

        {view === "selector" && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4">Select or Create Project</h2>
            <ProjectSelector onSelect={handleSelect} onCreate={handleCreate} />
          </div>
        )}

        {view === "project" && selectedVideoId && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <code className="text-xs text-gray-500 bg-black/30 px-2 py-1 rounded">
                {selectedVideoId}
              </code>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Register</h2>
                    <p className="text-sm text-gray-400">Add base videos</p>
                  </div>
                </div>
                <AsyncUploader
                  type="register"
                  baseVideoId={selectedVideoId}
                  onUploadComplete={handleUploadComplete}
                />
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Verify</h2>
                    <p className="text-sm text-gray-400">Check for matches</p>
                  </div>
                </div>
                <AsyncUploader
                  type="verify"
                  baseVideoId={selectedVideoId}
                  onUploadComplete={handleUploadComplete}
                />
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">Jobs</h2>
              <JobList videoId={selectedVideoId} refreshTrigger={refreshTrigger} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
