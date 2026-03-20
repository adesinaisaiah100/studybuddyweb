"use client";

import React, { useEffect, useMemo, useState, use } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Titillium_Web, Outfit } from "next/font/google";
import {
  ArrowLeft,
  Settings,
  Trash2,
  Clock,
  MapPin,
  Loader2,
  Save,
  Home,
  Calendar,
  FileText,
  CheckSquare,
  BarChart,
  Bot,
  Plus,
  X,
  Edit2,
  UploadCloud,
  FileUp,
} from "lucide-react";
import { extractTextFromFile } from "@/utils/documentExtractor.client";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type CourseMaterial = {
  id: string;
  title: string;
  material_type: string;
  file_url: string;
  created_at: string;
};

type Schedule = {
  id: string;
  day: string;
  time_slot: string;
  venue: string | null;
};

type Course = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  course_schedules: Schedule[];
  course_materials?: CourseMaterial[];
};

type ProcessingJob = {
  id: string;
  material_id: string;
  status: "queued" | "extracting" | "vectorizing" | "completed" | "failed";
  milestone: "uploaded" | "extracting" | "vectorizing" | "complete" | "failed";
  eta_range: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  updated_at: string;
};

type OutlineModule = {
  title: string;
  summary: string;
  keywords: string[];
};

type CourseOutlineData = {
  id: string;
  status: "ready" | "partial" | "failed";
  outline_json: {
    courseTitle: string;
    overview: string;
    modules: OutlineModule[];
  };
  youtube_status?: string | null;
  web_status?: string | null;
  generated_at: string;
};

type ModuleResource = {
  id: string;
  module_slug: string;
  module_title: string;
  resource_type: "web" | "youtube";
  title: string;
  url: string;
  source: string;
  score: number;
};

const statusClassMap: Record<ProcessingJob["status"], string> = {
  queued: "bg-amber-50 text-amber-700 border border-amber-200",
  extracting: "bg-blue-50 text-blue-700 border border-blue-200",
  vectorizing: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  completed: "bg-green-50 text-green-700 border border-green-200",
  failed: "bg-red-50 text-red-700 border border-red-200",
};

const statusLabelMap: Record<ProcessingJob["status"], string> = {
  queued: "Queued",
  extracting: "Extracting",
  vectorizing: "Vectorizing",
  completed: "Ready",
  failed: "Failed",
};

export default function CourseDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Layout states
  const [activeTab, setActiveTab] = useState("overview");

  // Schedule modal states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState({ day: "Monday", time: "", venue: "" });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Upload modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("primary_slide");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);

  const fetcher = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      throw new Error("No user");
    }

    const { data, error } = await supabase
      .from("courses")
      .select("*, course_schedules(*), course_materials(*)")
      .eq("id", unwrappedParams.id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      router.push("/dashboard");
      throw new Error("Not found");
    }

    return data as Course;
  };

  const { data: course, error, mutate } = useSWR(`course-${unwrappedParams.id}`, fetcher);
  const jobsFetcher = async () => {
    if (!unwrappedParams.id) return [] as ProcessingJob[];
    try {
      const response = await fetch(`/api/process-jobs/status?courseId=${unwrappedParams.id}`);
      if (!response.ok) {
        return [] as ProcessingJob[];
      }
      const payload = await response.json();
      return (payload.jobs || []) as ProcessingJob[];
    } catch {
      return [] as ProcessingJob[];
    }
  };

  const { data: jobs = [], mutate: mutateJobs } = useSWR(
    `processing-jobs-${unwrappedParams.id}`,
    jobsFetcher,
    {
      refreshInterval: (latestJobs: ProcessingJob[] | undefined) =>
        latestJobs?.some((job) => ["queued", "extracting", "vectorizing"].includes(job.status))
          ? 10000
          : 0,
    }
  );

  const outlineFetcher = async () => {
    const response = await fetch(`/api/course-outline?courseId=${unwrappedParams.id}`);
    if (!response.ok) {
      return { outline: null as CourseOutlineData | null, resources: [] as ModuleResource[] };
    }

    const payload = await response.json();
    return {
      outline: (payload.outline ?? null) as CourseOutlineData | null,
      resources: (payload.resources ?? []) as ModuleResource[],
    };
  };

  const { data: outlineData, mutate: mutateOutline } = useSWR(
    `course-outline-${unwrappedParams.id}`,
    outlineFetcher,
    {
      refreshInterval: () => {
        const hasPendingJobs = jobs.some((job) => ["queued", "extracting", "vectorizing"].includes(job.status));
        return hasPendingJobs ? 12000 : 0;
      },
    }
  );

  const jobsByMaterialId = useMemo(() => {
    const map = new Map<string, ProcessingJob>();
    for (const job of jobs) {
      if (!map.has(job.material_id)) {
        map.set(job.material_id, job);
      }
    }
    return map;
  }, [jobs]);

  useEffect(() => {
    const hasPendingJobs = jobs.some((job) =>
      ["queued", "extracting", "vectorizing"].includes(job.status)
    );

    if (!hasPendingJobs) return;

    const interval = setInterval(() => {
      fetch("/api/process-jobs/run-next", { method: "POST" }).catch(() => {
        return;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [jobs]);

  const loading = !course && !error;

  const getJobForMaterial = (materialId: string) => jobsByMaterialId.get(materialId);

  const renderStatusBadge = (materialId: string) => {
    const job = getJobForMaterial(materialId);
    if (!job) return null;

    return (
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${statusClassMap[job.status]}`}>
        {statusLabelMap[job.status]}
      </span>
    );
  };

  // Sync editing fields with course data
  useEffect(() => {
    if (course && !editCode) {
      setEditCode(course.code);
      setEditTitle(course.title);
    }
  }, [course, editCode]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("courses")
      .update({
        code: editCode.trim(),
        title: editTitle.trim(),
      })
      .eq("id", course.id);

    setIsSaving(false);

    if (!error) {
      // Optimistic update
      mutate({ ...course, code: editCode.trim(), title: editTitle.trim() }, { revalidate: true });
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!course) return;
    if (!confirm("Are you sure you want to delete this course? This action cannot be undone.")) return;

    setIsDeleting(true);
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (!error) {
      router.push("/dashboard");
    } else {
      setIsDeleting(false);
      alert("Failed to delete course.");
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchedule(true);

    if (editingScheduleId) {
      // Update
      const { error } = await supabase
        .from("course_schedules")
        .update({
          day: newSchedule.day,
          time_slot: newSchedule.time,
          venue: newSchedule.venue || null,
        })
        .eq("id", editingScheduleId);

      if (!error) await mutate();
    } else {
      // Insert
      const { error } = await supabase
        .from("course_schedules")
        .insert({
          course_id: course!.id,
          day: newSchedule.day,
          time_slot: newSchedule.time,
          venue: newSchedule.venue || null,
        });

      if (!error) await mutate();
    }

    setIsSavingSchedule(false);
    setIsScheduleModalOpen(false);
    setNewSchedule({ day: "Monday", time: "", venue: "" });
    setEditingScheduleId(null);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("Remove this schedule?")) return;
    const { error } = await supabase.from("course_schedules").delete().eq("id", scheduleId);
    if (!error) await mutate();
  };

  const openAddScheduleModal = () => {
    setEditingScheduleId(null);
    setNewSchedule({ day: "Monday", time: "", venue: "" });
    setIsScheduleModalOpen(true);
  };

  const openEditScheduleModal = (slot: Schedule) => {
    setEditingScheduleId(slot.id);
    setNewSchedule({ day: slot.day, time: slot.time_slot, venue: slot.venue || "" });
    setIsScheduleModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadTitle) {
        // Remove extension for a cleaner title
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const getStoragePathFromPublicUrl = (publicUrl: string, bucketName: string) => {
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const markerIndex = publicUrl.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
  };

  const handleDeleteMaterial = async (material: CourseMaterial) => {
    if (!course) return;
    if (!confirm("Delete this uploaded material?")) return;

    setDeletingMaterialId(material.id);

    try {
      const storagePath = getStoragePathFromPublicUrl(material.file_url, "course-materials");
      if (storagePath) {
        await supabase.storage.from("course-materials").remove([storagePath]);
      }

      await supabase.from("course_embeddings").delete().eq("material_id", material.id);
      await supabase.from("processing_jobs").delete().eq("material_id", material.id);

      const { error: deleteError } = await supabase
        .from("course_materials")
        .delete()
        .eq("id", material.id)
        .eq("course_id", course.id);

      if (deleteError) {
        alert("Failed to delete material: " + deleteError.message);
      } else {
        await mutate();
        await mutateJobs();
        await mutateOutline();
      }
    } catch (deleteError) {
      alert("Failed to delete material. Please try again.");
      console.error("Delete material error", deleteError);
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return alert("Please select a file.");

    setIsUploading(true);
    const selectedFile = uploadFile;
    const selectedTitle = uploadTitle.trim();
    const selectedType = uploadType;
    
    try {
      // 1. Fast preview extraction (first pages / first chunk)
      setUploadProgress("Extracting preview pages...");
      const previewText = await extractTextFromFile(
        selectedFile,
        () => {
          setUploadProgress("Extracting preview pages...");
        },
        { pass: "preview" }
      );

      if (!previewText || previewText.trim() === "") {
        alert("Could not extract any text from this document. Please ensure it is a valid class material.");
        setIsUploading(false);
        setUploadProgress("");
        return;
      }

      // 2. Upload file to Supabase Storage
      const isPrimarySlide = selectedType === "primary_slide";
      setUploadProgress(
        isPrimarySlide
          ? "Uploading original file to cloud..."
          : "Uploading extracted text to cloud..."
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("You must be logged in to upload materials.");
        setIsUploading(false);
        setUploadProgress("");
        return;
      }

      let filePath = "";
      let fileToUpload: File | Blob;

      if (isPrimarySlide) {
        const fileExt = selectedFile.name.split(".").pop() || "";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        filePath = `${user.id}/${course!.id}/${fileName}`;
        fileToUpload = selectedFile;
      } else {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.txt`;
        filePath = `${user.id}/${course!.id}/${fileName}`;
        fileToUpload = new Blob([previewText], { type: "text/plain" });
      }

      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, fileToUpload);

      if (uploadError) {
        alert("Error uploading file: " + uploadError.message);
        setIsUploading(false);
        setUploadProgress("");
        return;
      }

      // 3. Get the public URL for the file
      const { data: publicUrlData } = supabase.storage
        .from('course-materials')
        .getPublicUrl(filePath);

      // 4. Insert record into course_materials table
      setUploadProgress("Saving material data...");
      const { data: newMaterial, error: dbError } = await supabase
        .from('course_materials')
        .insert({
          course_id: course!.id,
          title: selectedTitle,
          material_type: selectedType,
          file_url: publicUrlData.publicUrl,
        })
        .select()
        .single();

      if (dbError || !newMaterial) {
        alert("Error saving material info: " + (dbError?.message || 'Unknown error'));
      } else {
        const enqueueJob = async (rawText: string) => {
          const textBytes = new TextEncoder().encode(rawText);
          const hashBuffer = await crypto.subtle.digest("SHA-256", textBytes);
          const contentHash = Array.from(new Uint8Array(hashBuffer))
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");

          const processRes = await fetch("/api/process-jobs/enqueue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: newMaterial.id,
              courseId: course!.id,
              materialType: selectedType,
              title: selectedTitle,
              rawText,
              contentHash,
            }),
          });

          if (!processRes.ok) {
            console.error("Queueing failed", await processRes.text());
            return false;
          }

          return true;
        };

        // 5. Enqueue preview payload first for fast outline context
        setUploadProgress("Queuing quick analysis...");
        try {
          const quickQueued = await enqueueJob(previewText);

          if (quickQueued) {
            fetch("/api/process-jobs/run-next", { method: "POST" }).catch(() => {
              return;
            });
          }
        } catch (apiError) {
          console.error("Failed to queue processing API:", apiError);
        }

        // 6. Continue background extraction for remaining pages/chunks and re-enqueue full payload
        void (async () => {
          try {
            const remainingText = await extractTextFromFile(selectedFile, () => {
              return;
            }, { pass: "remainder" });

            const fullText = `${previewText}\n\n${remainingText}`.trim();
            if (!remainingText || fullText.length <= previewText.length) {
              return;
            }

            const fullQueued = await enqueueJob(fullText);
            if (fullQueued) {
              fetch("/api/process-jobs/run-next", { method: "POST" }).catch(() => {
                return;
              });
              await mutateJobs();
            }
          } catch (backgroundError) {
            console.error("Background full extraction enqueue failed:", backgroundError);
          }
        })();

        setUploadProgress("Uploaded. Processing in background...");
        // Refresh UI to show the new material
        await mutate();
        await mutateJobs();
        await mutateOutline();
      }
    } catch (error) {
      console.error(error);
      alert("An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
      setUploadProgress("");
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadType("primary_slide");
    }
  };

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left Sidebar Menu - Fixed to edge */}
      <div className="w-64 lg:w-72 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-200/60 bg-gray-50 z-10">
          <button
            onClick={() => router.push("/dashboard")}
            className={`flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium ${outfit.className}`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 custom-scrollbar">
          <div className="px-3 pb-4 pt-2 ">
            <h2 className={`font-bold text-gray-900 text-xl truncate ${titillium.className}`} title={course.code}>
              {course.code}
            </h2>
            <p className={`text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1 ${outfit.className} truncate`} title={course.title}>
              Course Portal
            </p>
          </div>
          
          <SidebarButton 
            icon={<Home className="w-5 h-5" />} 
            label="Overview" 
            active={activeTab === "overview"} 
            onClick={() => setActiveTab("overview")} 
          />
          <SidebarButton 
            icon={<Calendar className="w-5 h-5" />} 
            label="Schedules" 
            active={activeTab === "schedules"} 
            onClick={() => setActiveTab("schedules")} 
          />
          <SidebarButton 
            icon={<FileText className="w-5 h-5" />} 
            label="Materials" 
            active={activeTab === "materials"} 
            onClick={() => setActiveTab("materials")} 
          />
          <SidebarButton 
            icon={<FileText className="w-5 h-5" />} 
            label="Notes" 
            active={activeTab === "notes"} 
            onClick={() => setActiveTab("notes")} 
            badge="Soon"
          />
          <SidebarButton 
            icon={<CheckSquare className="w-5 h-5" />} 
            label="Quizzes" 
            active={activeTab === "quizzes"} 
            onClick={() => setActiveTab("quizzes")} 
            badge="Soon"
          />
          <SidebarButton 
            icon={<BarChart className="w-5 h-5" />} 
            label="Progress" 
            active={activeTab === "progress"} 
            onClick={() => setActiveTab("progress")} 
            badge="Soon"
          />
          
          <div className="my-3 border-t border-gray-200/60 mx-3" />
          
          <SidebarButton 
            icon={<Bot className="w-5 h-5 text-indigo-500" />} 
            label="Study Buddy AI" 
            active={activeTab === "ai"} 
            onClick={() => setActiveTab("ai")} 
            className="text-indigo-700 hover:bg-indigo-50/50"
          />
          <SidebarButton 
            icon={<Settings className="w-5 h-5" />} 
            label="Course Settings" 
            active={activeTab === "settings"} 
            onClick={() => setActiveTab("settings")} 
          />
        </div>
      </div>

      {/* Main Content Area - Full remaining width */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-white">
        <div className="p-8 sm:p-10 lg:p-12 max-w-6xl mx-auto w-full">
          {/* --- SETTINGS TAB --- */}
          {activeTab === "settings" && (
              <div className="max-w-2xl">
                <h2 className={`text-2xl font-bold text-gray-900 mb-6 ${titillium.className}`}>
                  Course Settings
                </h2>
                
                {isEditing ? (
                  <form onSubmit={handleUpdate} className={`space-y-4 ${outfit.className}`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Course Code
                      </label>
                      <input
                        type="text"
                        required
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Course Title
                      </label>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setEditCode(course.code);
                          setEditTitle(course.title);
                        }}
                        disabled={isSaving}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={`space-y-4 ${outfit.className}`}>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                      <p className="text-sm text-gray-500 mb-1">Course Code</p>
                      <p className="font-semibold text-gray-900 text-lg">{course.code}</p>
                      
                      <p className="text-sm text-gray-500 mb-1 mt-4">Course Title</p>
                      <p className="font-semibold text-gray-900 text-lg">{course.title}</p>
                      
                      <button
                        onClick={() => setIsEditing(true)}
                        className="mt-6 text-green-600 hover:text-green-700 font-medium flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Details
                      </button>
                    </div>

                    <div className="border-t border-gray-100 pt-6 mt-6">
                      <h3 className="text-red-600 font-semibold mb-2">Danger Zone</h3>
                      <p className="text-gray-500 text-sm mb-4">
                        Permanently remove this course and all associated data, including schedules, notes, and progress.
                      </p>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-red-600 border border-red-200 hover:bg-red-50 font-medium transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? "Deleting..." : "Delete Course"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- SCHEDULES TAB --- */}
            {activeTab === "schedules" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold text-gray-900 ${titillium.className}`}>Class Schedules</h2>
                    <p className={`text-gray-500 text-sm mt-1 ${outfit.className}`}>Manage your meeting times and locations.</p>
                  </div>
                  <button 
                    onClick={openAddScheduleModal}
                    className={`flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors ${outfit.className}`}
                  >
                    <Plus className="w-4 h-4" /> Add Slot
                  </button>
                </div>

                {course.course_schedules && course.course_schedules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {course.course_schedules.map((slot) => (
                      <div
                        key={slot.id}
                        className={`group bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm rounded-2xl p-4 flex items-start gap-4 transition-all ${outfit.className}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                          <Clock className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <p className="font-semibold text-gray-900">{slot.day}</p>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditScheduleModal(slot)} className="text-gray-400 hover:text-blue-500">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteSchedule(slot.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-gray-600 mt-0.5">{slot.time_slot}</p>
                          {slot.venue && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-2 bg-gray-100/50 w-fit px-2.5 py-1 rounded-lg">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{slot.venue}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className={`text-gray-500 font-medium ${outfit.className}`}>No schedules assigned yet.</p>
                    <button onClick={openAddScheduleModal} className={`text-green-600 font-medium text-sm mt-2 hover:underline ${outfit.className}`}>Add your first class time</button>
                  </div>
                )}
              </div>
            )}

            {/* --- OVERVIEW TAB --- */}
            {activeTab === "overview" && (
              <div>
                <p className={`text-sm font-semibold text-green-600 tracking-wider uppercase mb-2 ${outfit.className}`}>
                  {course.code}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight ${titillium.className}`}>
                    {course.title}
                  </h1>
                </div>

                {(!course.course_materials || !course.course_materials.find(m => m.material_type === 'primary_slide')) ? (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center mb-8">
                    <div className="w-20 h-20 bg-white shadow-sm text-green-600 rounded-2xl flex items-center justify-center mb-6">
                      <UploadCloud className="w-10 h-10" />
                    </div>
                    <h3 className={`text-2xl font-bold text-gray-900 mb-3 ${titillium.className}`}>
                      Upload Course Outline
                    </h3>
                    <p className={`text-gray-500 max-w-md mx-auto mb-8 ${outfit.className}`}>
                      Upload the main course syllabus or outline. We&apos;ll automatically structure your course dashboard based on it.
                    </p>
                    
                    <div className="w-full max-w-md bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Main Outline File</label>
                      <input 
                        type="file" 
                        accept=".pdf,.pptx,.docx,.txt"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setUploadFile(e.target.files[0]);
                            if (!uploadTitle) setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                            setUploadType("primary_slide");
                          }
                        }}
                        className="w-full mb-3 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      />
                      {uploadFile && (
                        <button
                          onClick={handleUploadSubmit}
                          disabled={isUploading}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                          {isUploading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress || "Uploading..."}</>
                          ) : (
                            <><FileUp className="w-4 h-4" /> Upload Course File</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mb-10">
                    <h3 className={`text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 ${titillium.className}`}>
                      <FileText className="w-5 h-5 text-green-600" /> Main Course Outline
                    </h3>
                    {course.course_materials.filter(m => m.material_type === 'primary_slide').map(mat => (
                      <div key={mat.id} className="p-5 rounded-2xl border border-green-200 bg-green-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-100 text-green-700 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <p className={`font-bold text-gray-900 text-lg line-clamp-1 ${outfit.className}`}>{mat.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className={`text-sm text-gray-500 font-medium tracking-wide ${outfit.className}`}>Primary File</p>
                              {renderStatusBadge(mat.id)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={mat.file_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-green-700 hover:text-green-800 bg-white px-4 py-2 border border-green-200 rounded-lg shadow-sm hover:shadow transition-all text-center">
                            View File
                          </a>
                          <button
                            onClick={() => handleDeleteMaterial(mat)}
                            disabled={deletingMaterialId === mat.id}
                            className="text-sm font-semibold text-red-600 hover:text-red-700 bg-white px-3 py-2 border border-red-200 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-60"
                          >
                            {deletingMaterialId === mat.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {jobs.some((job) => ["queued", "extracting", "vectorizing", "failed"].includes(job.status)) && (
                  <div className="mb-8 p-4 rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className={`text-sm font-semibold text-gray-900 ${outfit.className}`}>
                        Background Processing Queue
                      </h4>
                      <span className={`text-xs text-gray-500 ${outfit.className}`}>
                        Updates every few seconds
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {jobs
                        .filter((job) => ["queued", "extracting", "vectorizing", "failed"].includes(job.status))
                        .slice(0, 4)
                        .map((job) => (
                          <div key={job.id} className="flex items-center justify-between text-xs text-gray-600">
                            <span className="truncate pr-3">{statusLabelMap[job.status]}</span>
                            <span className="text-gray-500">{job.eta_range || "--"}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {outlineData?.outline && (
                  <div className="mb-10 rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className={`text-lg font-bold text-gray-900 ${titillium.className}`}>
                        Course Outline & Resources
                      </h3>
                      <span className={`text-xs text-gray-500 ${outfit.className}`}>
                        {outlineData.outline.youtube_status === "disabled_no_api_key"
                          ? "YouTube optional (API key not set)"
                          : "Web + YouTube resources"}
                      </span>
                    </div>

                    <p className={`text-sm text-gray-600 mb-4 ${outfit.className}`}>
                      {outlineData.outline.outline_json.overview}
                    </p>

                    <div className="mb-4">
                      <h4 className={`text-sm font-semibold text-gray-900 mb-2 ${outfit.className}`}>
                        Course Modules
                      </h4>
                      <ol className={`list-decimal list-inside text-sm text-gray-600 space-y-1 ${outfit.className}`}>
                        {outlineData.outline.outline_json.modules.map((module) => (
                          <li key={`list-${module.title}`}>{module.title}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="space-y-4">
                      {outlineData.outline.outline_json.modules.map((module) => {
                        const moduleResources = (outlineData.resources || []).filter(
                          (resource) => resource.module_title === module.title
                        );

                        return (
                          <div key={module.title} className="rounded-xl border border-gray-100 p-4">
                            <h4 className={`font-semibold text-gray-900 ${outfit.className}`}>{module.title}</h4>
                            <p className={`text-sm text-gray-600 mt-1 ${outfit.className}`}>{module.summary}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {module.keywords.map((keyword) => (
                                <span key={keyword} className={`text-[10px] px-2 py-1 rounded-md bg-gray-100 text-gray-600 ${outfit.className}`}>
                                  {keyword}
                                </span>
                              ))}
                            </div>

                            {moduleResources.length > 0 && (
                              <div className="mt-3 space-y-1">
                                {moduleResources.slice(0, 5).map((resource) => (
                                  <a
                                    key={resource.id}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`block text-sm text-blue-700 hover:underline ${outfit.className}`}
                                  >
                                    {resource.resource_type === "youtube" ? "[YouTube] " : "[Web] "}
                                    {resource.title}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <h3 className={`text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 ${titillium.className}`}>
                  <Calendar className="w-5 h-5 text-gray-400" /> Upcoming Classes
                </h3>
                
                {course.course_schedules && course.course_schedules.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {course.course_schedules.map((slot) => (
                      <div
                        key={slot.id}
                        className={`bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 ${outfit.className}`}
                      >
                        <Clock className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm leading-none">{slot.day}</p>
                          <p className="text-gray-500 text-xs mt-1">{slot.time_slot}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-gray-500 text-sm ${outfit.className}`}>No schedules added.</p>
                )}
              </div>
            )}

            {/* --- MATERIALS TAB --- */}
            {activeTab === "materials" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className={`text-2xl font-bold text-gray-900 ${titillium.className}`}>Course Materials</h2>
                    <p className={`text-gray-500 text-sm mt-1 ${outfit.className}`}>All additional resources and materials.</p>
                  </div>
                  <button
                    onClick={() => {
                        setUploadType('lecture_slide');
                        setIsUploadModalOpen(true);
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 focus:ring-4 focus:ring-green-200 px-5 py-2.5 rounded-xl font-semibold transition-all ${outfit.className}`}
                  >
                    <FileUp className="w-4 h-4" /> Upload Material
                  </button>
                </div>

                {(!course.course_materials || course.course_materials.length === 0 || (course.course_materials.length === 1 && course.course_materials[0].material_type === 'primary_slide')) ? (
                  <div className="text-center py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className={`text-gray-500 font-medium ${outfit.className}`}>No additional materials uploaded yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {course.course_materials.filter(mat => mat.material_type !== 'primary_slide').map((mat) => (
                      <div key={mat.id} className="p-4 rounded-xl border border-gray-200 hover:border-green-200 hover:shadow-md transition-all bg-white flex items-start gap-4">
                         <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                           <FileText className="w-6 h-6" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className={`font-bold text-gray-900 line-clamp-1 ${outfit.className}`} title={mat.title}>{mat.title}</p>
                           <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                             <p className={`text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block uppercase tracking-wider ${outfit.className}`}>{mat.material_type.replace('_', ' ')}</p>
                             {renderStatusBadge(mat.id)}
                           </div>
                         </div>
                         <div className="flex items-center gap-1">
                           <a href={mat.file_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-green-600 transition-colors p-2">
                              <UploadCloud className="w-5 h-5 rotate-180" />
                           </a>
                           <button
                             onClick={() => handleDeleteMaterial(mat)}
                             disabled={deletingMaterialId === mat.id}
                             className="text-gray-400 hover:text-red-600 transition-colors p-2 disabled:opacity-60"
                           >
                             <Trash2 className="w-5 h-5" />
                           </button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- PLACEHOLDERS --- */}
            {["notes", "quizzes", "progress", "ai"].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100 shadow-sm">
                  {activeTab === "ai" ? <Bot className="w-8 h-8 text-indigo-400" /> : <Loader2 className="w-8 h-8 text-gray-300" />}
                </div>
                <h2 className={`text-2xl font-bold text-gray-900 mb-2 ${titillium.className}`}>
                  Coming Soon
                </h2>
                <p className={`text-gray-500 max-w-sm ${outfit.className}`}>
                  We are working hard to bring this feature to your dashboard. Stay tuned for updates!
                </p>
              </div>
            )}
          </div>
        </div>

      {/* Add/Edit Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsScheduleModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className={`text-2xl font-bold text-gray-900 mb-6 ${titillium.className}`}>
              {editingScheduleId ? "Edit Class Time" : "Add Class Time"}
            </h2>

            <form onSubmit={handleSaveSchedule} className={`space-y-4 ${outfit.className}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                <select
                  required
                  value={newSchedule.day}
                  onChange={(e) => setNewSchedule({ ...newSchedule, day: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none bg-white text-gray-900"
                >
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                    <option key={day} value={day} className="text-gray-900">{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 08:00 AM - 10:00 AM"
                  value={newSchedule.time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Room 101"
                  value={newSchedule.venue}
                  onChange={(e) => setNewSchedule({ ...newSchedule, venue: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-gray-900"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingSchedule}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isSavingSchedule ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {editingScheduleId ? "Save Changes" : "Add Schedule"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Material Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => {
                if(!isUploading) setIsUploadModalOpen(false);
              }}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className={`text-2xl font-bold text-gray-900 mb-2 ${titillium.className}`}>
              Upload Material
            </h2>
            <p className={`text-gray-500 text-sm mb-6 ${outfit.className}`}>
              Add slides, textbooks, or past questions to your course vector database to train your AI Study Buddy.
            </p>

            <form onSubmit={handleUploadSubmit} className={`space-y-5 ${outfit.className}`}>
              
              {/* File Drop Area */}
              <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center relative ${uploadFile ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:border-green-400 hover:bg-green-50/50 transition-colors'}`}>
                 <input 
                   type="file" 
                   required
                   accept=".pdf,.pptx,.docx,.txt"
                   onChange={handleFileChange}
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                 />
                 <UploadCloud className={`w-8 h-8 mb-3 ${uploadFile ? 'text-green-600' : 'text-gray-400'}`} />
                 {uploadFile ? (
                   <p className="text-sm font-semibold text-green-700">{uploadFile.name}</p>
                 ) : (
                   <div className="text-sm text-gray-500">
                     <span className="font-semibold text-green-600">Click to upload</span> or drag and drop
                     <p className="text-xs text-gray-400 mt-1">PDF, PPTX, DOCX, or TXT (max. 10MB)</p>
                   </div>
                 )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Week 1 - Intro to Anatomy"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                <select
                  required
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none bg-white text-gray-900"
                >
                  
                  <option value="lecture_slide" className="text-gray-900">Lecture Slide</option>
                  <option value="textbook" className="text-gray-900">Textbook</option>
                  <option value="past_question" className="text-gray-900">Past Question / Exam</option>
                  <option value="notes" className="text-gray-900">Personal Notes</option>
                  <option value="other" className="text-gray-900">Other</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:bg-green-400"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {uploadProgress || "Processing Document..."}
                  </>
                ) : (
                  <>
                    <FileUp className="w-5 h-5" />
                    Upload and Queue Processing
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarButton({ 
  icon, 
  label, 
  active, 
  onClick, 
  badge,
  className = ""
}: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  badge?: string,
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all duration-200 ${outfit.className} ${
        active 
          ? "bg-white shadow-sm border border-gray-200/60 text-green-700 shadow-sm" 
          : `text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 border border-transparent ${className}`
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-green-600" : "text-gray-400"}`}>
          {icon}
        </div>
        <span>{label}</span>
      </div>
      {badge && (
        <span className="text-[10px] uppercase tracking-wider bg-gray-200/50 text-gray-500 font-bold px-2 py-0.5 rounded-md">
          {badge}
        </span>
      )}
    </button>
  );
}

