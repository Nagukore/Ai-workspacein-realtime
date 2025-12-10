import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/utils/supabaseClient";

const AddTaskModal = ({ isOpen, onClose, onTaskAdded }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
  });

  // Reset form every time modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: "",
        description: "",
        due_date: "",
      });
    }
  }, [isOpen]);

  // -------------------------
  // SUBMIT HANDLER
  // -------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.due_date) {
      toast.error("Please enter title and due date");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user?.id) {
      toast.error("Not authenticated");
      return;
    }

    const userId = userData.user.id;

    // Insert into Supabase
    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: userId,
          title: formData.title,
          description: formData.description,
          status: "Pending",
          due_date: formData.due_date,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      toast.error("Failed to create task");
      return;
    }

    toast.success("Task added successfully!");

    if (onTaskAdded) onTaskAdded(data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="
          bg-gradient-to-b from-slate-900 to-slate-800 
          border border-slate-700 
          text-white rounded-xl shadow-xl 
          max-w-md p-6
        "
      >
        <DialogHeader>
          <DialogTitle
            className="text-2xl font-semibold flex items-center gap-2"
            style={{ fontFamily: "Work Sans" }}
          >
            <FilePlus2 className="w-6 h-6 text-blue-400" />
            Create New Task
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label className="text-slate-300">Task Title *</Label>
            <Input
              placeholder="Enter task title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="
                bg-slate-900/60 border-slate-700 text-white 
                focus:ring-1 focus:ring-blue-500 focus:border-blue-500
              "
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-slate-300">Description</Label>
            <Textarea
              placeholder="Describe the task..."
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="
                bg-slate-900/60 border-slate-700 text-white 
                focus:ring-1 focus:ring-blue-500 focus:border-blue-500
              "
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="text-slate-300">Due Date *</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                className="
                  pl-10 bg-slate-900/60 border-slate-700 text-white 
                  focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                "
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="
                flex-1 border-slate-600 text-slate-300 
                hover:bg-slate-700 hover:text-white
              "
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className="
                flex-1 bg-blue-600 hover:bg-blue-700 
                text-white shadow-md
              "
            >
              Save Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskModal;
