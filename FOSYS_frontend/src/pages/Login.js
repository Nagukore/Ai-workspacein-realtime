import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "../utils/api";

const SignupPage = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "INTERN",
  });

  const [errors, setErrors] = useState({});

  // --------------------------------
  // Input handler
  // --------------------------------
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  // --------------------------------
  // SIGNUP HANDLER (Backend Only)
  // --------------------------------
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    let newErrors = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      // -------------------------------------------
      // 1️⃣ CALL BACKEND /signup (server creates Auth user)
      // -------------------------------------------
      const response = await api.post("/signup", formData);

      if (!response.data?.success) {
        toast.error("Signup failed", {
          description: response.data?.message || "Unknown error",
        });
        setLoading(false);
        return;
      }

      toast.success("Account created successfully!");
      toast.success("Please verify your email before logging in.");

      // -------------------------------------------
      // 2️⃣ Redirect to Login
      // -------------------------------------------
      navigate("/login");

    } catch (err) {
      console.error("Signup error:", err);
      toast.error("Signup failed", {
        description: err.response?.data?.detail || err.message,
      });
    }

    setLoading(false);
  };

  // --------------------------------
  // UI
  // --------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400">Join your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 p-8 rounded-xl border border-slate-700">
          <form onSubmit={handleSignup} className="space-y-6">

            {/* Name */}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                name="name"
                placeholder="John Doe"
                onChange={handleChange}
                className="bg-slate-900/50 text-white"
              />
              {errors.name && (
                <p className="text-red-500 text-sm">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                placeholder="you@example.com"
                onChange={handleChange}
                className="bg-slate-900/50 text-white"
              />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  onChange={handleChange}
                  className="bg-slate-900/50 text-white pr-10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-slate-400"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>

              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full bg-slate-900/50 border border-slate-600 text-white rounded p-2"
              >
                <option value="INTERN">Intern</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {/* Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </Button>

          </form>

          {/* Footer */}
          <div className="mt-4 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-blue-400 font-medium"
              >
                Sign In
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SignupPage;
