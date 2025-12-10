// src/pages/LoginPage.js

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "@/utils/api";
import { supabase } from "@/utils/supabaseClient";

const LoginPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.email || !formData.password) {
      setErrors({
        email: !formData.email ? "Email is required" : "",
        password: !formData.password ? "Password is required" : "",
      });
      setLoading(false);
      return;
    }

    try {
      // 1️⃣ Backend login (bcrypt verification)
      const response = await api.post("/login", formData);
      const user = response.data?.user;

      if (!user) {
        toast.error("Login failed");
        setLoading(false);
        return;
      }

      toast.success(`Welcome back, ${user.name}!`);

      // Save backend user
      localStorage.setItem("fosys_user", JSON.stringify(user));

      // 2️⃣ Supabase Auth Login (NEEDED for RLS)
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        console.error("Supabase login failed:", authError);
        toast.error("Supabase authentication failed");
        setLoading(false);
        return;
      }

      console.log("✓ Supabase auth session created.");

      // 3️⃣ Route by role
      const role = (user.role || "INTERN").toLowerCase();
      navigate(`/dashboard/${role}`);

    } catch (err) {
      console.error("Login error:", err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Invalid credentials";

      toast.error("Login failed", { description: msg });
      setErrors({ password: msg });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Sign In</h1>
          <p className="text-slate-400">Welcome back</p>
        </div>

        <div className="bg-slate-800/50 p-8 rounded-xl border border-slate-700">

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Email */}
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 pr-10 bg-slate-900/50 border-slate-600 text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>

            {/* Footer */}
            <div className="mt-8 text-center space-y-3">
              <p className="text-slate-500 text-sm">New user?</p>
              <button
                onClick={() => navigate("/signup")}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Create account
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
