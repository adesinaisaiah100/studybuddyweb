"use client";

import React, { useEffect, useState, use } from "react";
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
  const loading = !course && !error;

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

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return alert("Please select a file.");

    setIsUploading(true);
    
    try {
      // 1. Client-Side Text Extraction (Prevents server timeouts and reads scanned PDF images)
      setUploadProgress("Extracting text locally...");
      const extractedText = await extractTextFromFile(uploadFile, (progressStatus) => {
        setUploadProgress(progressStatus);
      });

      if (!extractedText || extractedText.trim() === "") {
        alert("Could not extract any text from this document. Please ensure it is a valid class material.");
        setIsUploading(false);
        setUploadProgress("");
        return;
      }

      // 2. Upload only the Extracted Text to Supabase Storage (Saves ~95% space vs storing heavy PDFs!)
      setUploadProgress("Uploading extracted text to cloud...");
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.txt`;
      const filePath = `${course!.id}/${fileName}`;
      
      // Convert the raw string into a Blob
      const textBlob = new Blob([extractedText], { type: 'text/plain' });

      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, textBlob);

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
          title: uploadTitle.trim(),
          material_type: uploadType,
          file_url: publicUrlData.publicUrl,
        })
        .select()
        .single();

      if (dbError || !newMaterial) {
        alert("Error saving material info: " + (dbError?.message || 'Unknown error'));
      } else {
        // 5. Call the Document Processing API, passing the RAW text we just extracted!
        setUploadProgress("Generating AI vectors...");
        try {
          const processRes = await fetch("/api/process-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              materialId: newMaterial.id,
              courseId: course!.id,
              materialType: uploadType,
              title: uploadTitle.trim(),
              rawText: extractedText, // Send the locally extracted text directly!
            }),
          });

          if (!processRes.ok) {
            console.error("Vector processing failed", await processRes.text());
          }
        } catch (apiError) {
          console.error("Failed to call processing API:", apiError);
        }

        setUploadProgress("Finished!");
        // Refresh UI to show the new material
        await mutate();
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
                  {course.course_materials && course.course_materials.length > 0 && (
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className={`flex-shrink-0 flex items-center gap-2 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 px-4 py-2.5 rounded-xl font-semibold transition-colors ${outfit.className}`}
                    >
                      <FileUp className="w-4 h-4" /> Add Material
                    </button>
                  )}
                </div>

                {(!course.course_materials || course.course_materials.length === 0) ? (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center mb-8">
                    <div className="w-20 h-20 bg-white shadow-sm text-green-600 rounded-2xl flex items-center justify-center mb-6">
                      <UploadCloud className="w-10 h-10" />
                    </div>
                    <h3 className={`text-2xl font-bold text-gray-900 mb-3 ${titillium.className}`}>
                      Upload Course Knowledge
                    </h3>
                    <p className={`text-gray-500 max-w-md mx-auto mb-8 ${outfit.className}`}>
                      Get started by uploading your main course slide, syllabus, or textbook. We&apos;ll automatically build your course outline and train your Study Buddy AI.
                    </p>
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className={`bg-green-600 hover:bg-green-700 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-2 ${outfit.className}`}
                    >
                      <FileUp className="w-5 h-5" />
                      Upload First Material
                    </button>
                  </div>
                ) : (
                  <div className="mb-10">
                    <h3 className={`text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 ${titillium.className}`}>
                      <FileText className="w-5 h-5 text-gray-400" /> Course Materials
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {course.course_materials.map((mat) => (
                        <div key={mat.id} className="p-4 rounded-xl border border-gray-200 hover:border-green-200 transition-colors bg-white flex items-start gap-4">
                           <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                             <FileText className="w-5 h-5" />
                           </div>
                           <div>
                             <p className={`font-semibold text-gray-900 line-clamp-1 ${outfit.className}`}>{mat.title}</p>
                             <p className={`text-xs text-gray-500 uppercase tracking-widest mt-1 ${outfit.className}`}>{mat.material_type.replace('_', ' ')}</p>
                           </div>
                        </div>
                      ))}
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
                        className={`bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3 ${outfit.className}`}
                      >
                        <Clock className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800 text-sm leading-none">{slot.day}</p>
                          <p className="text-green-600 text-xs mt-1">{slot.time_slot}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-gray-500 text-sm ${outfit.className}`}>No schedules added.</p>
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
                  <option value="primary_slide" className="text-gray-900">Primary Course Slide / Syllabus</option>
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
                    Upload and Process
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
