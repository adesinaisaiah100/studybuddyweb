"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Titillium_Web, Outfit } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    "idle" | "uploading" | "parsing" | "extracting" | "done" | "error"
  >("idle");
  const [error, setError] = useState("");

  const validateFile = (f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      return "Please upload a PDF or DOCX file.";
    }
    if (f.size > MAX_FILE_SIZE) {
      return "File must be under 10MB.";
    }
    return null;
  };

  const handleFile = (f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const getFileExtension = (filename: string) => {
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress("uploading");
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setUploading(false);
        setUploadProgress("error");
        return;
      }

      // 1. Upload file to Supabase Storage
      const fileExt = getFileExtension(file.name);
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("timetables")
        .upload(filePath, file);

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        setUploadProgress("error");
        return;
      }

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("timetables").getPublicUrl(filePath);

      // 2. Save document record to Supabase
      const { data: docRecord, error: dbError } = await supabase
        .from("raw_documents")
        .insert({
          user_id: user.id,
          file_url: publicUrl,
          file_type: fileExt === "pdf" ? "pdf" : "docx",
        })
        .select()
        .single();

      if (dbError || !docRecord) {
        setError(`Failed to save document record: ${dbError?.message}`);
        setUploading(false);
        setUploadProgress("error");
        return;
      }

      // 3. Parse document + AI course extraction
      setUploadProgress("parsing");

      const extractResponse = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docRecord.id }),
      });

      if (!extractResponse.ok) {
        const extractError = await extractResponse.json();
        setError(extractError.error || "Failed to extract courses.");
        setUploading(false);
        setUploadProgress("error");
        return;
      }

      const extractResult = await extractResponse.json();

      if (!extractResult.success) {
        setError("Failed to extract courses from timetable.");
        setUploading(false);
        setUploadProgress("error");
        return;
      }

      // 4. Done!
      setUploadProgress("done");

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch {
      setError("Something went wrong. Please try again.");
      setUploading(false);
      setUploadProgress("error");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 overflow-hidden relative">


      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 text-green-700 text-sm font-medium mb-6">
            <Upload className="w-4 h-4" />
            <span className={outfit.className}>Upload Your Timetable</span>
          </div>
          <h1
            className={`text-3xl sm:text-4xl font-bold text-gray-900 mb-3 ${titillium.className}`}
          >
            Let&apos;s set up your <span className="text-green-500">courses.</span>
          </h1>
          <p
            className={`text-gray-500 text-base sm:text-lg ${outfit.className}`}
          >
            Upload your timetable and we&apos;ll automatically create your course cards.
          </p>
        </div>

        {/* Upload Card */}
        <div
          className={`bg-white/70 backdrop-blur-xl border rounded-3xl p-6 sm:p-8 shadow-sm ${outfit.className} ${
            dragActive
              ? "border-green-400 bg-green-50/30"
              : "border-gray-100"
          } transition-all duration-200`}
        >
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? "border-green-400 bg-green-50/50"
                : file
                ? "border-green-300 bg-green-50/30"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleInputChange}
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-base">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                    {getFileExtension(file.name).toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-700 text-base">
                    Drop your timetable here
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    or click to browse • PDF, DOCX (max 10MB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Progress Steps */}
          {uploading && uploadProgress !== "error" && (
            <div className="mt-6 space-y-3">
              <ProgressStep
                label="Uploading file to cloud..."
                active={uploadProgress === "uploading"}
                done={["parsing", "extracting", "done"].includes(uploadProgress)}
              />
              <ProgressStep
                label="Parsing document & extracting courses..."
                active={uploadProgress === "parsing" || uploadProgress === "extracting"}
                done={uploadProgress === "done"}
              />
              <ProgressStep
                label="Courses ready!"
                active={false}
                done={uploadProgress === "done"}
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mt-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Upload button */}
          {uploadProgress !== "done" && (
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="group w-full flex items-center justify-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-2xl font-semibold text-base hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 mt-6"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  Upload & Generate Courses
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          )}

          {/* Success message */}
          {uploadProgress === "done" && (
            <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-100 rounded-2xl px-4 py-4 mt-4">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Timetable uploaded!</p>
                <p className="text-sm text-green-600">
                  Redirecting to your dashboard...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <div className="w-8 h-1.5 rounded-full bg-green-500" />
          <div className="w-8 h-1.5 rounded-full bg-green-500" />
          <div className="w-8 h-1.5 rounded-full bg-gray-200" />
        </div>
        <p
          className={`text-center text-sm text-gray-400 mt-3 ${outfit.className}`}
        >
          Step 2 of 3 — Upload Timetable
        </p>
      </div>
    </div>
  );
}

function ProgressStep({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : active ? (
        <Loader2 className="w-5 h-5 text-green-500 animate-spin flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
      )}
      <span
        className={`text-sm ${
          done ? "text-green-700" : active ? "text-gray-900" : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
