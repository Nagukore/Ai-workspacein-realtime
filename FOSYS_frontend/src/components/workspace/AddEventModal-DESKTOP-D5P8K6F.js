import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/utils/supabaseClient";
import { EVENT_TYPES } from "@/utils/constants";

const AddEventModal = ({ isOpen, onClose, selectedDate = null, onEventAdded = null }) => {
  const [form, setForm] = useState({ title: "", description: "", type: "SCRUM", date: selectedDate || "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // when selectedDate changes, update local state
    setForm((s) => ({ ...s, date: selectedDate || s.date }));
  }, [selectedDate]);

  const handleChange = (patch) => setForm((s) => ({ ...s, ...patch }));

  const reset = () => setForm({ title: "", description: "", type: "SCRUM", date: selectedDate || "" });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.type || !form.date) {
      toast.error("Please provide title, type and date for the event.");
      return;
    }

    setLoading(true);
    try {
      // get supabase auth user
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;

      if (authErr || !user?.id) {
        console.warn("AddEvent: no auth user", authErr);
        toast.error("You must be signed in to add events. Please sign in and try again.");
        setLoading(false);
        return;
      }

      const payload = {
        user_id: user.id,
        title: form.title.trim(),
        description: form.description?.trim() || "",
        type: form.type,
        date: form.date,
      };

      const { data, error } = await supabase.from("events").insert([payload]).select().maybeSingle();

      if (error) {
        console.error("Supabase insert error (events):", error);
        // common RLS issue
        if (error.status === 403) {
          toast.error("Permission denied. Check RLS policies or use the anon/public key for client access.");
        } else {
          toast.error("Failed to add event. Try again.");
        }
      } else {
        toast.success("Event added");
        reset();
        onClose?.();
        onEventAdded?.(data || null);
      }
    } catch (err) {
      console.error("Unexpected AddEvent error:", err);
      toast.error("Unexpected error when adding event.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={Boolean(isOpen)} onOpenChange={() => onClose?.()}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add Event</DialogTitle>
          <p className="text-slate-400 text-sm">Date: {form.date || "Choose a date"}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="event-title" className="text-slate-200">Title *</Label>
            <Input
              id="event-title"
              placeholder="E.g. Sprint Planning"
              value={form.title}
              onChange={(e) => handleChange({ title: e.target.value })}
              className="bg-slate-900/50 border-slate-600 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description" className="text-slate-200">Description</Label>
            <Textarea
              id="event-description"
              placeholder="Short description (optional)"
              value={form.description}
              onChange={(e) => handleChange({ description: e.target.value })}
              className="bg-slate-900/50 border-slate-600 text-white"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Event Type *</Label>
              <Select onValueChange={(v) => handleChange({ type: v })} value={form.type}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {Object.entries(EVENT_TYPES).map(([key, value]) => (
                    <SelectItem key={key} value={key} className="text-white">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${value.color}`} />
                        <span>{value.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Date *</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => handleChange({ date: e.target.value })}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onClose?.(); }}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEventModal;
