"use client";

import { useState, useRef } from "react";

type TaskData = {
  taskId: string;
  status: string;
  [key: string]: unknown;
};

type Props = {
  type: "register" | "verify";
  baseVideoId?: string;
  onTaskStarted: (taskId: string) => void;
  onResult: (data: TaskData) => void;
  onSessionStarted?: (sessionId: string) => void;
};

export default function UploadForm({ type, baseVideoId, onTaskStarted, onResult, onSessionStarted }: Props) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<{ completed: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/")) {
        setFileName(file.name);
        if (fileInputRef.current) {
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInputRef.current.files = dt.files;
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus("Please select a file");
      return;
    }

    setUploading(true);
    setStatus("Uploading...");
    setChunkProgress(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (type === "verify" && baseVideoId) {
        formData.append("baseVideoId", baseVideoId);
      }

      const endpoint = type === "register" ? "/api/register" : "/api/verify";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      if (type === "verify" && data.taskIds) {
        const { sessionId, taskIds, totalChunks } = data;
        setStatus(`Processing ${totalChunks} chunks...`);
        setChunkProgress({ completed: 0, total: totalChunks });

        if (onSessionStarted) {
          onSessionStarted(sessionId);
        }

        for (const taskId of taskIds) {
          onTaskStarted(taskId);
        }

        let completedCount = 0;
        const taskIdsParam = taskIds.join(",");
        const eventSource = new EventSource(
          `/api/session/${sessionId}?taskIds=${taskIdsParam}&totalChunks=${totalChunks}`
        );

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);

            if (parsed.type === "session_complete") {
              eventSource.close();
              setStatus("All chunks completed");
              setUploading(false);
              setFileName("");
              setChunkProgress(null);
              return;
            }

            if (parsed.type === "timeout") {
              eventSource.close();
              setStatus("Session timeout");
              setUploading(false);
              setChunkProgress(null);
              return;
            }

            const taskData: TaskData = {
              taskId: parsed.taskId,
              status: parsed.status || "unknown",
              ...parsed,
            };
            onResult(taskData);

            if (taskData.status === "completed" || taskData.status === "failed") {
              completedCount++;
              setChunkProgress({ completed: completedCount, total: totalChunks });
            }
          } catch {
            // ignore
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setStatus("Connection error");
          setUploading(false);
          setChunkProgress(null);
        };
      } else {
        const { taskId } = data;
        onTaskStarted(taskId);
        setStatus("Processing...");

        const eventSource = new EventSource(`/api/status/${taskId}`);

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const taskData: TaskData = {
              taskId,
              status: parsed.status || "unknown",
              ...parsed,
            };
            onResult(taskData);

            if (taskData.status === "completed" || taskData.status === "failed") {
              eventSource.close();
              setStatus(taskData.status === "completed" ? "Completed" : "Failed");
              setUploading(false);
              setFileName("");
            }
          } catch {
            // ignore
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setStatus("Connection error");
          setUploading(false);
        };
      }
    } catch (error) {
      setStatus("Error: " + (error as Error).message);
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragActive
            ? "border-purple-400 bg-purple-500/10"
            : "border-white/20 hover:border-white/40"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          disabled={uploading}
          onChange={handleFileChange}
          className="hidden"
        />
        {fileName ? (
          <div className="text-white">
            <svg className="w-8 h-8 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm truncate">{fileName}</p>
          </div>
        ) : (
          <div className="text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm">Drop video here or click to browse</p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={uploading || !fileName}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all ${
          uploading || !fileName
            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
            : type === "register"
            ? "bg-purple-500 hover:bg-purple-600 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : type === "register" ? (
          "Register Video"
        ) : (
          "Verify Video"
        )}
      </button>

      {chunkProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Chunks processed</span>
            <span>{chunkProgress.completed} / {chunkProgress.total}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(chunkProgress.completed / chunkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {status && !chunkProgress && (
        <p className={`text-sm text-center ${
          status === "Completed" || status === "All chunks completed" ? "text-green-400" :
          status === "Failed" || status.startsWith("Error") || status === "Completed with errors" ? "text-red-400" :
          "text-gray-400"
        }`}>
          {status}
        </p>
      )}
    </form>
  );
}
