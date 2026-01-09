"use client";

import { useState, useRef } from "react";

type Props = {
  type: "register" | "verify";
  baseVideoId: string;
  onUploadComplete: () => void;
};

export default function AsyncUploader({ type, baseVideoId, onUploadComplete }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("video/"));
      for (const file of files) {
        await uploadFile(file);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await uploadFile(file);
      }
      e.target.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      if (type === "verify") {
        formData.append("baseVideoId", baseVideoId);
      }

      const endpoint = type === "register"
        ? `/api/register?videoId=${baseVideoId}`
        : "/api/verify";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setProgress(`Queued: ${file.name}`);
      onUploadComplete();

      setTimeout(() => {
        setProgress("");
      }, 2000);
    } catch (error) {
      setProgress(`Failed: ${file.name}`);
      setTimeout(() => {
        setProgress("");
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const accentColor = type === "register" ? "purple" : "blue";

  return (
    <div className="space-y-3">
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          dragActive
            ? `border-${accentColor}-400 bg-${accentColor}-500/10`
            : uploading
            ? "border-gray-500 bg-gray-500/10 cursor-wait"
            : "border-white/20 hover:border-white/40"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          disabled={uploading}
          onChange={handleFileChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center justify-center gap-3">
            <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-gray-400">{progress}</span>
          </div>
        ) : (
          <div className="text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm">
              {type === "register"
                ? "Drop registration videos here"
                : "Drop verification videos here"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Multiple files supported</p>
          </div>
        )}
      </div>

      {progress && !uploading && (
        <p className={`text-sm text-center ${
          progress.startsWith("Failed") ? "text-red-400" : "text-green-400"
        }`}>
          {progress}
        </p>
      )}
    </div>
  );
}
