// src/pages/InternTasks.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/utils/supabaseClient";
import api from "@/utils/api";
import { getStatusColor, formatDate } from "@/utils/constants";

/**
 * InternTasks
 *
 * - Fetch tasks for the logged-in user via backend (GET /tasks)
 * - Filter tasks by user_id (UUID from supabase.auth.getUser())
 * - Subscribe to Supabase realtime changes for the tasks table
 * - Listen for BroadcastChannel messages (tasks_channel) and localStorage fallback
 * - Allow inline status updates (PUT /tasks/{id})
 */

const InternTasks = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const userIdRef = useRef(null);
  const channelRef = useRef(null);
  const bcRef = useRef(null);

  // --------------------------
  // Resolve logged-in user's UUID (cached)
  // --------------------------
  const resolveUserId = useCallback(async () => {
    if (userIdRef.current) return userIdRef.current;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (user?.id) {
        userIdRef.current = user.id;
        return user.id;
      }
    } catch (err) {
      console.warn("resolveUserId error", err);
    }
    return null;
  }, []);

  // --------------------------
  // Fetch tasks from backend and filter by user_id
  // --------------------------
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const uuid = await resolveUserId();
      if (!uuid) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const resp = await api.get("/tasks");
      const all = resp?.data?.data || resp?.data || [];

      // Filter tasks that belong to this user (user_id column)
      const mine = all.filter((t) => String(t.user_id) === String(uuid));
      setTasks(mine);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [resolveUserId]);

  // --------------------------
  // Broadcast to other pages/tabs that tasks changed
  // Utility used by updateStatus and any internal refresh triggers
  // --------------------------
  const broadcastTasksChanged = useCallback(() => {
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const bc = new BroadcastChannel("tasks_channel");
        bc.postMessage({ type: "tasks_changed", ts: Date.now() });
        bc.close();
      } else {
        // fallback
        localStorage.setItem("tasks_channel_ping", Date.now().toString());
      }
    } catch (e) {
      console.warn("broadcast error", e);
    }
  }, []);

  // --------------------------
  // Realtime + Broadcast listeners
  // --------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      await fetchTasks();

      // Supabase realtime subscription
      if (supabase && typeof supabase.channel === "function") {
        // remove existing if present
        if (channelRef.current) {
          try {
            supabase.removeChannel(channelRef.current);
          } catch (e) {
            /* ignore */
          }
          channelRef.current = null;
        }

        const uuid = await resolveUserId();
        if (!uuid) return;

        const channel = supabase
          .channel("tasks-realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "tasks" },
            (payload) => {
              try {
                const newRow = payload?.new;
                const oldRow = payload?.old;

                // Only refresh when change affects this user
                if ((newRow && String(newRow.user_id) === String(uuid)) || (oldRow && String(oldRow.user_id) === String(uuid))) {
                  fetchTasks();
                }
              } catch (e) {
                console.warn("realtime handling error", e);
                fetchTasks();
              }
            }
          )
          .subscribe();

        channelRef.current = channel;
      }

      // BroadcastChannel listener for cross-tab updates
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const bc = new BroadcastChannel("tasks_channel");
        bc.onmessage = (ev) => {
          if (ev?.data?.type === "tasks_changed") {
            fetchTasks();
          }
        };
        bcRef.current = bc;
      }

      // localStorage fallback
      const onStorage = (ev) => {
        if (ev.key === "tasks_channel_ping") {
          fetchTasks();
        }
      };
      window.addEventListener("storage", onStorage);

      // cleanup on unmount
      return () => {
        mounted = false;
        try {
          if (channelRef.current) supabase.removeChannel(channelRef.current);
        } catch (e) {
          /* ignore */
        }
        if (bcRef.current) {
          try {
            bcRef.current.close();
          } catch (e) {
            /* ignore */
          }
          bcRef.current = null;
        }
        window.removeEventListener("storage", onStorage);
      };
    })();

    // explicit cleanup when effect re-runs
    return () => {
      try {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      } catch (e) {}
      if (bcRef.current) {
        try {
          bcRef.current.close();
        } catch (e) {}
        bcRef.current = null;
      }
    };
  }, [fetchTasks, resolveUserId]);

  // --------------------------
  // Update task status (inline)
  // - Calls PUT /tasks/{id} with { status: newStatus }
  // - Broadcasts update to other tabs/pages
  // - Refreshes local list
  // --------------------------
  const updateStatus = useCallback(
    async (taskId, newStatus) => {
      try {
        await api.put(`/tasks/${taskId}`, { status: newStatus });
        // notify other pages
        broadcastTasksChanged();
        // refresh local tasks
        await fetchTasks();
      } catch (err) {
        console.error("Failed to update task status:", err);
      }
    },
    [fetchTasks, broadcastTasksChanged]
  );

  // --------------------------
  // Filters & derived lists
  // --------------------------
  const filteredTasks = tasks.filter((t) => {
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return true;
    const title = (t.title || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    return title.includes(q) || desc.includes(q);
  });

  const todayTasks = filteredTasks.filter((t) => t.status === "InProgress" || t.status === "Pending");
  const pendingTasks = filteredTasks.filter((t) => t.status === "Pending");
  const completedTasks = filteredTasks.filter((t) => t.status === "Completed");

  // --------------------------
  // Task card (with dropdown status)
  // --------------------------
  const TaskCard = ({ task }) => {
    return (
      <div className="group bg-slate-900/60 p-5 rounded-xl border border-slate-700 hover:border-sky-500 transition">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-1">{task.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{task.description}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <select
              value={task.status}
              onChange={(e) => updateStatus(task.id, e.target.value)}
              className={`px-3 py-1 rounded-md text-xs cursor-pointer ${getStatusColor(task.status)} bg-slate-800 border border-slate-700`}
            >
              <option value="Pending">Pending</option>
              <option value="InProgress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-500 mt-3">
          <span>📅 Due: {task.due_date ? formatDate(task.due_date) : "No due date"}</span>
          <span>🕒 Created: {formatDate(task.created_at)}</span>
        </div>
      </div>
    );
  };

  // --------------------------
  // Render
  // --------------------------
  if (loading) {
    return <div className="p-8 text-center text-white">Loading tasks…</div>;
  }

  return (
    <div className="p-8 min-h-screen bg-slate-950">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-6">My Tasks</h1>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/60 border-slate-700 text-white"
          />
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-white text-xl mb-3">Today's Tasks</h2>
          {todayTasks.length ? (
            <div className="space-y-4">
              {todayTasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No active tasks for today</p>
          )}
        </section>

        <section>
          <h2 className="text-white text-xl mb-3">Pending Tasks</h2>
          {pendingTasks.length ? (
            <div className="space-y-4">
              {pendingTasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No pending tasks</p>
          )}
        </section>

        <section>
          <h2 className="text-white text-xl mb-3">Completed Tasks</h2>
          {completedTasks.length ? (
            <div className="space-y-4">
              {completedTasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No completed tasks yet</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default InternTasks;
