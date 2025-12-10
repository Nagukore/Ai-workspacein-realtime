// src/pages/InternHome.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckSquare,
  Plus,
  Github,
  FileText,
  Loader2,
  Search,
  Copy,
  Download,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Tag,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddTaskModal from "@/components/workspace/AddTaskModal";
import { getStatusColor, formatDate } from "@/utils/constants";
import { supabase } from "@/utils/supabaseClient";
import api from "@/utils/api";
import { toast } from "sonner";

/**
 * InternHome — updated and Supabase-connected
 *
 * - Loads tasks from Supabase (for authenticated user)
 * - Realtime updates for tasks (inserts/updates/deletes)
 * - Loads meeting summaries from backend API
 * - Converts meeting pending items to tasks in Supabase
 * - AddTaskModal inserts tasks to Supabase (via callback)
 *
 * Drop into src/pages/InternHome.js
 */

const IconButton = ({ title, onClick, children, className = "", disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-md hover:bg-white/5 transition-colors ${disabled ? "opacity-60 pointer-events-none" : ""} ${className}`}
  >
    {children}
  </button>
);

const LoadingBlock = ({ text = "Loading…" }) => (
  <div className="flex items-center gap-3 text-slate-400">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span>{text}</span>
  </div>
);

const InternHome = ({ user }) => {
  // UI / data state
  const [showAddTask, setShowAddTask] = useState(false);

  // Meetings (from backend API)
  const [meetingSummaries, setMeetingSummaries] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [meetingSearch, setMeetingSearch] = useState("");
  const [expandedMeetingId, setExpandedMeetingId] = useState(null);
  const [reviewedMeetings, setReviewedMeetings] = useState({});

  // Tasks (from Supabase)
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const tasksSubscriptionRef = useRef(null);

  // Small UX flags
  const [copying, setCopying] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState(null);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // --------------------------
  // Fetch meeting summaries
  // --------------------------
  const fetchMeetingSummaries = useCallback(async () => {
    setLoadingMeetings(true);
    try {
      const response = await api.get("/meeting-summary");
      const meetings = response?.data?.data || [];
      setMeetingSummaries(meetings);
    } catch (err) {
      console.error("Failed to fetch meeting summaries:", err);
      setMeetingSummaries([]);
      toast.error("Failed to fetch meeting summaries");
    } finally {
      setLoadingMeetings(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetingSummaries();
  }, [fetchMeetingSummaries]);

  // --------------------------
  // Fetch tasks for current user
  // --------------------------
  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      // Use supabase auth to get the actual UID (this must match RLS)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.error("Auth getUser error:", userErr);
        setTasks([]);
        return;
      }
      const currentUserId = userData?.user?.id || user?.id;
      if (!currentUserId) {
        console.warn("No authenticated user found for tasks fetch.");
        setTasks([]);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("id, user_id, title, description, status, due_date, created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error);
        setTasks([]);
      } else {
        setTasks(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching tasks:", err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [user]);

  useEffect(() => {
    // initial fetch
    fetchTasks();

    // subscribe to realtime changes on tasks table
    // this uses supabase-js v2 channel / postgres_changes API
    // We only update local list for rows that belong to current user (best-effort)
    const setupRealtime = async () => {
      try {
        // avoid double subscription
        if (tasksSubscriptionRef.current) return;

        const channel = supabase
          .channel("public:tasks")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "tasks" },
            (payload) => {
              // payload structure can vary by SDK version — handle common shapes
              try {
                const evt = payload?.eventType || payload.event;
                const newRow = payload.new || payload.record || payload.new;
                const oldRow = payload.old || payload.old;

                // Only operate if we can identify current user
                // best-effort: if newRow.user_id exists and matches currently loaded tasks owner, update
                if (evt === "INSERT" && newRow) {
                  setTasks((prev) => {
                    // avoid duplicates
                    if (prev.some((t) => t.id === newRow.id)) return prev;
                    return [newRow, ...prev];
                  });
                } else if (evt === "UPDATE" && newRow) {
                  setTasks((prev) => prev.map((t) => (t.id === newRow.id ? newRow : t)));
                } else if (evt === "DELETE" && oldRow) {
                  setTasks((prev) => prev.filter((t) => t.id !== oldRow.id));
                } else {
                  // fallback: refresh
                  fetchTasks();
                }
              } catch (e) {
                console.warn("Realtime payload handling error:", e);
                fetchTasks();
              }
            }
          )
          .subscribe();

        tasksSubscriptionRef.current = channel;
      } catch (err) {
        console.warn("Realtime subscription failed:", err);
      }
    };

    setupRealtime();

    return () => {
      try {
        if (tasksSubscriptionRef.current) {
          supabase.removeChannel(tasksSubscriptionRef.current);
          tasksSubscriptionRef.current = null;
        }
      } catch (err) {
        // ignore cleanup errors
      }
    };
  }, [fetchTasks]);

  // --------------------------
  // Filters & search
  // --------------------------
  const normalizedTaskSearch = (task) => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return true;
    const title = (task.title || "").toLowerCase();
    const desc = (task.description || "").toLowerCase();
    return title.includes(q) || desc.includes(q);
  };

  const filteredTasks = tasks.filter(normalizedTaskSearch);
  const todayTasks = filteredTasks.filter((t) => t.status === "InProgress" || t.status === "Pending");
  const pendingTasks = filteredTasks.filter((t) => t.status === "Pending");
  const completedTasks = filteredTasks.filter((t) => t.status === "Completed");

  const meetingMatches = (m) => {
    const q = meetingSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (m.meeting_name || "").toLowerCase();
    const summary = (m.summary || "").toLowerCase();
    return name.includes(q) || summary.includes(q);
  };
  const filteredMeetings = meetingSummaries.filter(meetingMatches);

  // --------------------------
  // Meeting UI helpers
  // --------------------------
  const toggleExpand = (id) => {
    setExpandedMeetingId((prev) => (prev === id ? null : id));
  };

  const markAsReviewed = (meetingId) => {
    setReviewedMeetings((prev) => ({ ...prev, [meetingId]: true }));
  };

  const copyTranscript = async (meeting) => {
    if (!meeting) return;
    const content = [
      `Meeting: ${meeting.meeting_name}`,
      "",
      `Summary:\n${meeting.summary || ""}`,
      "",
      `Tasks:\n${(meeting.tasks || []).map((t) => ` - ${t.task || t}`).join("\n")}`,
      "",
      `Pending:\n${(meeting.pending_tasks || []).map((p) => ` - ${p.task || p}`).join("\n")}`,
      "",
      `Created: ${meeting.created_at || ""}`,
    ].join("\n");

    try {
      setCopying(true);
      await navigator.clipboard.writeText(content);
      toast.success("Copied transcript to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Failed to copy transcript");
    } finally {
      setCopying(false);
    }
  };

  const downloadTranscript = (meeting) => {
    if (!meeting) return;
    const content = [
      `Meeting: ${meeting.meeting_name}`,
      "",
      `Summary:\n${meeting.summary || ""}`,
      "",
      `Tasks:\n${(meeting.tasks || []).map((t) => ` - ${t.task || t}`).join("\n")}`,
      "",
      `Pending:\n${(meeting.pending_tasks || []).map((p) => ` - ${p.task || p}`).join("\n")}`,
      "",
      `Created: ${meeting.created_at || ""}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(meeting.meeting_name || "meeting").replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // --------------------------
  // Convert meeting pending item -> Supabase task
  // --------------------------
  const createTaskFromMeetingPending = async (meetingId, pendingItem, setPendingProcessing) => {
    const taskText = typeof pendingItem === "string" ? pendingItem : pendingItem?.task || JSON.stringify(pendingItem);
    if (!taskText || !taskText.trim()) {
      toast.error("Invalid pending item");
      return;
    }

    try {
      setPendingProcessing(true);
      setCreatingTaskId(meetingId);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        console.error("Not authenticated for creating task:", userError);
        toast.error("You must be signed in to create tasks");
        return;
      }
      const userId = userData.user.id;

      const { data, error } = await supabase.from("tasks").insert([
        {
          user_id: userId,
          title: taskText.length > 100 ? `${taskText.slice(0, 97)}...` : taskText,
          description: taskText,
          status: "Pending",
          due_date: null,
        },
      ]).select();

      if (error) {
        console.error("Create task error:", error);
        toast.error("Failed to create task");
      } else {
        toast.success("Task created from meeting pending");
        // fetch tasks (or rely on realtime)
        await fetchTasks();
      }
    } catch (err) {
      console.error("Unexpected createTaskFromMeetingPending:", err);
      toast.error("Something went wrong creating task");
    } finally {
      setCreatingTaskId(null);
      setPendingProcessing(false);
    }
  };

  // --------------------------
  // AddTaskModal callback
  // --------------------------
  const onTaskAdded = async () => {
    await fetchTasks();
  };

  // --------------------------
  // UI render components
  // --------------------------
  const MeetingCard = ({ meeting }) => {
    const isExpanded = expandedMeetingId === meeting.id;
    const pending = meeting.pending_tasks || [];
    const tasksList = meeting.tasks || [];
    const [pendingProcessing, setPendingProcessing] = useState(false);

    return (
      <article
        className={`group bg-gradient-to-br from-slate-800/40 to-slate-800/30 p-6 rounded-2xl border border-slate-700 transition-all duration-300 hover:shadow-xl hover:shadow-amber-900/20`}
        aria-expanded={isExpanded}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 pr-3">
            <h3 className="text-white font-semibold text-lg mb-1">{meeting.meeting_name}</h3>
            <p className="text-slate-400 text-sm line-clamp-2">{meeting.summary || "No summary available"}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <IconButton
                title={isExpanded ? "Hide details" : "View details"}
                onClick={() => toggleExpand(meeting.id)}
                className="text-amber-400"
              >
                {isExpanded ? (
                  <span className="flex items-center gap-1 text-amber-300 text-xs">
                    <ChevronUp className="w-4 h-4" /> Hide
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 text-xs">
                    <ChevronDown className="w-4 h-4" /> View
                  </span>
                )}
              </IconButton>
            </div>

            <div className="flex items-center gap-1">
              <IconButton title="Copy transcript" onClick={() => copyTranscript(meeting)} disabled={copying}>
                <Copy className="w-4 h-4 text-slate-300" />
              </IconButton>
              <IconButton title="Download transcript" onClick={() => downloadTranscript(meeting)}>
                <Download className="w-4 h-4 text-slate-300" />
              </IconButton>
              <IconButton
                title="Mark as reviewed"
                onClick={() => markAsReviewed(meeting.id)}
                className={`${reviewedMeetings[meeting.id] ? "bg-emerald-900/30 text-emerald-300" : ""}`}
              >
                <Check className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 animate-[fadeIn_220ms_ease]">
            <div className="text-slate-300 text-sm leading-relaxed mb-4">{meeting.summary}</div>

            {tasksList.length > 0 && (
              <div className="mb-4">
                <p className="text-slate-200 font-medium mb-2">Tasks:</p>
                <ul className="list-disc list-inside text-slate-400 text-sm space-y-1">
                  {tasksList.map((t, idx) => (
                    <li key={idx}>{t.task || t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-3">
              <p className="text-slate-200 font-medium mb-2">Pending:</p>
              {pending.length === 0 ? (
                <p className="text-slate-400 italic text-sm">No pending items</p>
              ) : (
                <ul className="list-disc list-inside text-slate-400 text-sm space-y-2">
                  {pending.map((p, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span>{p.task || p}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sky-400 text-xs px-2 py-1 rounded bg-sky-900/30 hover:bg-sky-800 transition-colors"
                          onClick={() => createTaskFromMeetingPending(meeting.id, p, setPendingProcessing)}
                          disabled={creatingTaskId === meeting.id || pendingProcessing}
                        >
                          {creatingTaskId === meeting.id || pendingProcessing ? "Adding..." : "Add as Task"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 text-xs text-slate-500 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{meeting.created_at ? new Date(meeting.created_at).toLocaleString() : "Unknown date"}</span>
            </div>
          </div>
        )}
      </article>
    );
  };

  const TaskCard = ({ task }) => (
    <div
      className="group relative bg-gradient-to-br from-slate-900/60 to-slate-800/40 p-5 rounded-xl border border-slate-700 hover:border-sky-500/50 hover:shadow-sky-900/20 transition-all duration-300 transform hover:-translate-y-1"
      data-testid={`task-card-${task.id}`}
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-400/10 opacity-0 group-hover:opacity-100 blur-md transition-all duration-500 pointer-events-none"></div>

      <div className="relative flex items-start justify-between mb-3">
        <div className="flex-1 pr-4">
          <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-sky-300 transition-colors">{task.title}</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{task.description}</p>
        </div>
        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
          {task.status === "Completed" && <Check className="w-3.5 h-3.5" />}
          {task.status === "Pending" && <Tag className="w-3.5 h-3.5" />}
          {task.status === "InProgress" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {task.status}
        </span>
      </div>

      <div className="flex items-center gap-5 text-xs text-slate-500 mt-3">
        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDate(task.due_date)}</span>
        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatDate(task.created_at)}</span>
      </div>
    </div>
  );

  // --------------------------
  // Main render
  // --------------------------
  return (
    <div className="p-8 min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* HEADER */}
      <div className="mb-10">
        <p className="text-slate-400 text-sm mb-1">{currentDate}</p>
        <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight bg-gradient-to-r from-blue-400 via-sky-300 to-cyan-300 text-transparent bg-clip-text" style={{ fontFamily: "Work Sans" }}>
          Hey {user?.name?.split(" ")[0] || "Intern"}, ready to elevate your progress? 🚀
        </h1>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search tasks & meetings..."
            value={taskSearch || meetingSearch}
            onChange={(e) => {
              const q = e.target.value;
              setTaskSearch(q);
              setMeetingSearch(q);
            }}
            className="pl-10 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
          <Button onClick={() => setShowAddTask(true)} className="flex-1 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-medium py-4">
            <Plus className="w-5 h-5 mr-2" /> Add Task
          </Button>

          <Button onClick={() => window.open("https://github.com", "_blank")} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800/50 py-4">
            <Github className="w-5 h-5 mr-2 text-white" /> GitHub
          </Button>
        </div>
      </div>

      {/* Tasks block */}
      <section className="space-y-10 mb-16">
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-xl transition-all hover:shadow-sky-900/20">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <CheckSquare className="text-sky-400 w-6 h-6" /> Tasks of the Day
          </h2>

          <div className="space-y-4">
            {loadingTasks ? (
              <div className="py-8 flex justify-center"><LoadingBlock text="Loading tasks …" /></div>
            ) : todayTasks.length ? (
              todayTasks.map((t) => <TaskCard key={t.id} task={t} />)
            ) : (
              <div className="py-8 text-center text-slate-400 italic">No active tasks for today 🌤️</div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-xl transition-all hover:shadow-sky-900/20">
          <h2 className="text-2xl font-semibold text-white mb-4">Pending Tasks</h2>
          <div className="space-y-4">
            {loadingTasks ? (
              <div className="py-8 flex justify-center"><LoadingBlock text="Loading…" /></div>
            ) : pendingTasks.length ? (
              pendingTasks.map((t) => <TaskCard key={t.id} task={t} />)
            ) : (
              <div className="py-8 text-center text-slate-400 italic">All tasks are on track ✅</div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-xl transition-all hover:shadow-sky-900/20">
          <h2 className="text-2xl font-semibold text-white mb-4">Completed Tasks</h2>
          <div className="space-y-4">
            {loadingTasks ? (
              <div className="py-8 flex justify-center"><LoadingBlock text="Loading…" /></div>
            ) : completedTasks.length ? (
              completedTasks.map((t) => <TaskCard key={t.id} task={t} />)
            ) : (
              <div className="py-8 text-center text-slate-400 italic">No completed tasks yet ⚙️</div>
            )}
          </div>
        </div>
      </section>

      {/* Meeting transcripts (FULL WIDTH, BELOW TASKS) */}
      <section className="bg-slate-900/70 rounded-2xl border border-slate-800 p-8 shadow-xl transition-all hover:shadow-amber-900/20 mb-20">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-7 h-7 text-amber-400" />
          <h2 className="text-3xl font-semibold text-white tracking-wide">Meeting Transcripts</h2>
        </div>

        {loadingMeetings ? (
          <div className="py-8 flex items-center justify-center"><LoadingBlock text="Fetching meeting summaries..." /></div>
        ) : filteredMeetings.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 italic">No meeting transcripts found yet.</div>
        )}
      </section>

      {/* Add Task Modal */}
      <AddTaskModal isOpen={showAddTask} onClose={() => setShowAddTask(false)} onTaskAdded={onTaskAdded} />
    </div>
  );
};

export default InternHome;