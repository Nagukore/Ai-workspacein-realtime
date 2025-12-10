// src/pages/InternHome.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
 * Optimized InternHome
 * - Fixes undefined variables in createTaskFromMeetingPending
 * - Debounced search
 * - Memoized TaskCard/MeetingCard
 * - Robust supabase realtime handling + safe cleanup
 * - Lightweight helper hooks inside file (no extra deps)
 */

// ---------- Helpers ----------
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

// simple debounce hook (no external dependency)
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const lookupEmployeeAuthColumns = [
  "supabase_user_id",
  "auth_user_id",
  "auth_id",
  "user_uuid",
  "supabase_id",
  "auth_uuid",
];

// ---------- Main Component ----------
const InternHome = ({ user }) => {
  // UI / data
  const [showAddTask, setShowAddTask] = useState(false);
  const [meetingSummaries, setMeetingSummaries] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [meetingSearch, setMeetingSearch] = useState("");
  const [expandedMeetingId, setExpandedMeetingId] = useState(null);
  const [reviewedMeetings, setReviewedMeetings] = useState({});

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const tasksSubscriptionRef = useRef(null);

  const [copying, setCopying] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState(null);

  const [pendingProcessingMap, setPendingProcessingMap] = useState({});

  const resolvedSupabaseUserIdRef = useRef(null);
  const mountedRef = useRef(true);

  const debouncedSearch = useDebouncedValue(taskSearch || meetingSearch, 280);

  const currentDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  // --------------------------
  // Resolve Supabase Auth UUID for given user prop
  // cached in ref to avoid re-resolving
  // --------------------------
  const resolveSupabaseUserId = useCallback(async () => {
    if (resolvedSupabaseUserIdRef.current) return resolvedSupabaseUserIdRef.current;
    if (!user) return null;

    // direct candidates
    const directCandidates = [
      user.supabase_user_id,
      user.auth_user_id,
      user.auth_id,
      user.auth_uuid,
      user.uuid,
      user.user_uuid,
      user.user_id,
      user.id,
    ].filter(Boolean);

    for (const c of directCandidates) {
      if (typeof c === "string" && c.includes("-")) {
        resolvedSupabaseUserIdRef.current = c;
        return c;
      }
    }

    // try supabase auth
    try {
      const { data: authData } = await supabase.auth.getUser?.();
      const authUser = authData?.user;
      if (authUser?.id) {
        resolvedSupabaseUserIdRef.current = authUser.id;
        return authUser.id;
      }
    } catch (e) {
      // ignore
    }

    // numeric id fallback -> lookup employee table
    const numericId = Number(user.id);
    if (!Number.isNaN(numericId)) {
      try {
        const { data, error } = await supabase
          .from("employee")
          .select(lookupEmployeeAuthColumns.join(","))
          .eq("id", numericId)
          .maybeSingle();
        if (!error && data) {
          for (const col of lookupEmployeeAuthColumns) {
            if (data[col] && typeof data[col] === "string" && data[col].includes("-")) {
              resolvedSupabaseUserIdRef.current = data[col];
              return data[col];
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }

    return null;
  }, [user]);

  // --------------------------
  // Fetch meeting summaries
  // --------------------------
  const fetchMeetingSummaries = useCallback(async () => {
    setLoadingMeetings(true);
    try {
      const resp = await api.get("/meeting-summary");
      const meetings = resp?.data?.data || resp?.data || [];
      setMeetingSummaries(meetings);
    } catch (err) {
      console.error("Failed to fetch meeting summaries:", err);
      toast.error("Failed to fetch meeting summaries");
      setMeetingSummaries([]);
    } finally {
      setLoadingMeetings(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetingSummaries();
  }, [fetchMeetingSummaries]);

  // --------------------------
  // Fetch tasks
  // --------------------------
  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const supaUserId = await resolveSupabaseUserId();
      if (!supaUserId) {
        setTasks([]);
        setLoadingTasks(false);
        return;
      }

      const res = await api.get("/tasks");
      const list = (res && (res.data?.data || res.data)) || [];
      setTasks(list);
    } catch (err) {
      console.error("Unexpected error fetching tasks:", err);
      toast.error("Unexpected error fetching tasks");
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [resolveSupabaseUserId]);

  // --------------------------
  // Supabase realtime for tasks (robust)
  // --------------------------
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      await fetchTasks();

      const supaUserId = await resolveSupabaseUserId();
      if (!supaUserId) return;

      // clear previous channel
      if (tasksSubscriptionRef.current) {
        try {
          supabase.removeChannel(tasksSubscriptionRef.current);
        } catch (e) {
          // ignore
        }
        tasksSubscriptionRef.current = null;
      }

      if (!supabase || typeof supabase.channel !== "function") {
        console.warn("Supabase realtime channel is not available");
        return;
      }

      const channel = supabase
        .channel("public:tasks")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tasks" },
          (payload) => {
            try {
              const evt = payload?.eventType || payload.event;
              const newRow = payload?.new || payload?.record;
              const oldRow = payload?.old;
              if (evt === "INSERT" && newRow && String(newRow.user_id) === String(supaUserId)) {
                setTasks((prev) => {
                  if (prev.some((t) => t.id === newRow.id)) return prev;
                  return [newRow, ...prev];
                });
              } else if (evt === "UPDATE" && newRow && String(newRow.user_id) === String(supaUserId)) {
                setTasks((prev) => prev.map((t) => (t.id === newRow.id ? newRow : t)));
              } else if (evt === "DELETE" && oldRow && String(oldRow.user_id) === String(supaUserId)) {
                setTasks((prev) => prev.filter((t) => t.id !== oldRow.id));
              } else {
                // fallback
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
    })();

    return () => {
      mountedRef.current = false;
      if (tasksSubscriptionRef.current) {
        try {
          supabase.removeChannel(tasksSubscriptionRef.current);
        } catch (e) {
          // ignore
        }
        tasksSubscriptionRef.current = null;
      }
    };
  }, [fetchTasks, resolveSupabaseUserId]);

  // --------------------------
  // Filters and derived lists (memoized)
  // --------------------------
  const normalizedTaskSearch = useCallback(
    (task) => {
      const q = (debouncedSearch || "").trim().toLowerCase();
      if (!q) return true;
      const title = (task.title || "").toLowerCase();
      const desc = (task.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    },
    [debouncedSearch]
  );

  const filteredTasks = useMemo(() => tasks.filter(normalizedTaskSearch), [tasks, normalizedTaskSearch]);
  const todayTasks = useMemo(() => filteredTasks.filter((t) => t.status === "InProgress" || t.status === "Pending"), [filteredTasks]);
  const pendingTasks = useMemo(() => filteredTasks.filter((t) => t.status === "Pending"), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter((t) => t.status === "Completed"), [filteredTasks]);

  const meetingMatches = useCallback(
    (m) => {
      const q = (debouncedSearch || "").trim().toLowerCase();
      if (!q) return true;
      const name = (m.meeting_name || "").toLowerCase();
      const summary = (m.summary || "").toLowerCase();
      return name.includes(q) || summary.includes(q);
    },
    [debouncedSearch]
  );
  const filteredMeetings = useMemo(() => meetingSummaries.filter(meetingMatches), [meetingSummaries, meetingMatches]);

  // --------------------------
  // UI helpers
  // --------------------------
  const toggleExpand = useCallback((id) => setExpandedMeetingId((prev) => (prev === id ? null : id)), []);
  const markAsReviewed = useCallback((meetingId) => setReviewedMeetings((prev) => ({ ...prev, [meetingId]: true })), []);

  const copyTranscript = useCallback(async (meeting) => {
    if (!meeting) return;
    const parseItems = (arr) => {
      if (!arr) return [];
      if (typeof arr === "string") {
        try {
          return JSON.parse(arr);
        } catch {
          return [arr];
        }
      }
      return Array.isArray(arr) ? arr : [arr];
    };
    const tasksArr = parseItems(meeting.tasks);
    const pendingArr = parseItems(meeting.pending_tasks);

    const content = [
      `Meeting: ${meeting.meeting_name}`,
      "",
      `Summary:\n${meeting.summary || ""}`,
      "",
      `Tasks:\n${tasksArr.map((t) => ` - ${t.task || t}`).join("\n")}`,
      "",
      `Pending:\n${pendingArr.map((p) => ` - ${p.task || p}`).join("\n")}`,
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
  }, []);

  const downloadTranscript = useCallback((meeting) => {
    if (!meeting) return;
    const parseItems = (arr) => {
      if (!arr) return [];
      if (typeof arr === "string") {
        try {
          return JSON.parse(arr);
        } catch {
          return [arr];
        }
      }
      return Array.isArray(arr) ? arr : [arr];
    };
    const tasksArr = parseItems(meeting.tasks);
    const pendingArr = parseItems(meeting.pending_tasks);

    const content = [
      `Meeting: ${meeting.meeting_name}`,
      "",
      `Summary:\n${meeting.summary || ""}`,
      "",
      `Tasks:\n${tasksArr.map((t) => ` - ${t.task || t}`).join("\n")}`,
      "",
      `Pending:\n${pendingArr.map((p) => ` - ${p.task || p}`).join("\n")}`,
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
  }, []);

  // --------------------------
  // Convert meeting pending item -> Task (fixed)
  // --------------------------
  const createTaskFromMeetingPending = useCallback(
    async (meetingId, pendingItem) => {
      const taskText =
        typeof pendingItem === "string"
          ? pendingItem
          : pendingItem?.task ||
            (typeof pendingItem === "object" ? JSON.stringify(pendingItem) : String(pendingItem || ""));

      if (!taskText || !taskText.trim()) {
        toast.error("Invalid pending item");
        return;
      }

      setPendingProcessingMap((prev) => ({ ...prev, [meetingId]: true }));
      setCreatingTaskId(meetingId);

      try {
        const supaUserId = await resolveSupabaseUserId();
        if (!supaUserId) {
          toast.error("Cannot create task: supabase user id not resolved.");
          return;
        }

        const payload = {
          assigned_to: supaUserId,
          title: taskText,
          description: taskText,
          status: "Pending",
          due_date: null,
        };

        await api.post("/tasks", payload);
        toast.success("Task created from meeting pending");
        await fetchTasks();
      } catch (err) {
        console.error("Create task error:", err);
        toast.error("Failed to create task");
      } finally {
        setPendingProcessingMap((prev) => ({ ...prev, [meetingId]: false }));
        setCreatingTaskId(null);
      }
    },
    [resolveSupabaseUserId, fetchTasks]
  );

  const onTaskAdded = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  // ---------- Memoized presentational components ----------
  const MeetingCard = useMemo(
    () =>
      React.memo(function MeetingCardInner({ meeting }) {
        const isExpanded = expandedMeetingId === meeting.id;
        const pending = typeof meeting.pending_tasks === "string" ? (() => {
          try { return JSON.parse(meeting.pending_tasks); } catch { return [meeting.pending_tasks]; }
        })() : (meeting.pending_tasks || []);
        const tasksList = typeof meeting.tasks === "string" ? (() => {
          try { return JSON.parse(meeting.tasks); } catch { return [meeting.tasks]; }
        })() : (meeting.tasks || []);
        const meetingProcessing = Boolean(pendingProcessingMap[meeting.id]) || creatingTaskId === meeting.id;

        return (
          <article className={`group bg-gradient-to-br from-slate-800/40 to-slate-800/30 p-6 rounded-2xl border border-slate-700 transition-all duration-300 hover:shadow-xl hover:shadow-amber-900/20`} aria-expanded={isExpanded}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 pr-3">
                <h3 className="text-white font-semibold text-lg mb-1">{meeting.meeting_name}</h3>
                <p className="text-slate-400 text-sm line-clamp-2">{meeting.summary || "No summary available"}</p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <IconButton title={isExpanded ? "Hide details" : "View details"} onClick={() => toggleExpand(meeting.id)} className="text-amber-400">
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
                  <IconButton title="Mark as reviewed" onClick={() => markAsReviewed(meeting.id)} className={`${reviewedMeetings[meeting.id] ? "bg-emerald-900/30 text-emerald-300" : ""}`}>
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
                              onClick={() => createTaskFromMeetingPending(meeting.id, p)}
                              disabled={meetingProcessing}
                            >
                              {meetingProcessing ? "Adding..." : "Add as Task"}
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
      }),
    // dependencies referenced inside memoized component:
    [expandedMeetingId, pendingProcessingMap, creatingTaskId, copyTranscript, downloadTranscript, reviewedMeetings, toggleExpand, createTaskFromMeetingPending, markAsReviewed, copying]
  );

  const TaskCard = useMemo(
    () =>
      React.memo(function TaskCardInner({ task }) {
        return (
          <div className="group relative bg-gradient-to-br from-slate-900/60 to-slate-800/40 p-5 rounded-xl border border-slate-700 hover:border-sky-500/50 hover:shadow-sky-900/20 transition-all duration-300 transform hover:-translate-y-1" data-testid={`task-card-${task.id}`}>
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
      }),
    []
  );

  // --------------------------
  // Render
  // --------------------------
  return (
    <div className="p-8 min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* HEADER */}
      <div className="mb-10">
        <p className="text-slate-400 text-sm mb-1">{currentDate}</p>
        <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight bg-gradient-to-r from-blue-400 via-sky-300 to-cyan-300 text-transparent bg-clip-text" style={{ fontFamily: "Work Sans" }}>
          Hey {user?.name?.split(" ")[0] || "Intern"}, ready to elevate your progress?
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
              <div className="py-8 text-center text-slate-400 italic">No active tasks for today</div>
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
              <div className="py-8 text-center text-slate-400 italic">All tasks are on track</div>
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
              <div className="py-8 text-center text-slate-400 italic">No completed tasks yet</div>
            )}
          </div>
        </div>
      </section>

      {/* Meeting transcripts */}
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
