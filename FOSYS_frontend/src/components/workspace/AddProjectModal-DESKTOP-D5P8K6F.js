import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/utils/supabaseClient";

const AddProjectModal = ({ isOpen, onClose, onProjectAdded = null }) => {
  const [form, setForm] = useState({ title: "", description: "", status: "Upcoming", deadline: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (patch) => setForm((s) => ({ ...s, ...patch }));

  const reset = () => setForm({ title: "", description: "", status: "Upcoming", deadline: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Please provide title and description.");
      return;
    }

    setLoading(true);
    try {
      // get authenticated supabase user
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authErr || !user?.id) {
        toast.error("You must be signed in to create projects.");
        setLoading(false);
        return;
      }

      const payload = {
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        progress: 0,
        deadline: form.deadline || null,
      };

      const { data, error } = await supabase.from("projects").insert([payload]).select().maybeSingle();

      if (error) {
        console.error("Supabase insert error (projects):", error);
        if (error.status === 403) {
          toast.error("Permission denied. Check RLS policies.");
        } else {
          toast.error("Failed to create project.");
        }
      } else {
        toast.success("Project created");
        reset();
        onClose?.();
        onProjectAdded?.(data || null);
      }
    } catch (err) {
      console.error("Unexpected AddProject error:", err);
      toast.error("Unexpected error when creating project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={Boolean(isOpen)} onOpenChange={() => onClose?.()}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="project-title" className="text-slate-200">Project Title *</Label>
            <Input
              id="project-title"
              placeholder="E.g. AI Cleanup Drones"
              value={form.title}
              onChange={(e) => handleChange({ title: e.target.value })}
              className="bg-slate-900/50 border-slate-600 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description" className="text-slate-200">Short Description *</Label>
            <Textarea
              id="project-description"
              placeholder="A short summary of the project"
              value={form.description}
              onChange={(e) => handleChange({ description: e.target.value })}
              className="bg-slate-900/50 border-slate-600 text-white"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Status *</Label>
              <Select onValueChange={(v) => handleChange({ status: v })} value={form.status}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="Ongoing" className="text-white">Ongoing</SelectItem>
                  <SelectItem value="Upcoming" className="text-white">Upcoming</SelectItem>
                  <SelectItem value="Completed" className="text-white">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => handleChange({ deadline: e.target.value })}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
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
              data-testid="add-project-save-btn"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? "Saving…" : "Save Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectModal;
