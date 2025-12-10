// src/pages/SignupPage.js

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, User, Mail, Lock, Users, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api from "@/utils/api";

const SignupPage = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    role: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Validate password rules
  const validatePassword = (pw) => {
    setPasswordValidation({
      minLength: pw.length >= 8,
      hasUpperCase: /[A-Z]/.test(pw),
      hasLowerCase: /[a-z]/.test(pw),
      hasNumber: /[0-9]/.test(pw),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(pw),
    });
  };

  const handleChange = (e) => {
    if (e.target.name === "password") {
      validatePassword(e.target.value);
    }

    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleRoleChange = (value) => {
    setFormData({ ...formData, role: value });
    setErrors({ ...errors, role: "" });
  };

  // -------------------------------
  // SUBMIT SIGNUP (Backend Only)
  // -------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let validationErrors = {};

    if (!formData.name) validationErrors.name = "Full name is required";
    if (!formData.email) validationErrors.email = "Email is required";
    if (!formData.department) validationErrors.department = "Department is required";
    if (!formData.role) validationErrors.role = "Role is required";
    if (!formData.password) validationErrors.password = "Password is required";
    if (!formData.confirmPassword)
      validationErrors.confirmPassword = "Confirm password is required";

    if (formData.password !== formData.confirmPassword)
      validationErrors.confirmPassword = "Passwords do not match";

    if (!Object.values(passwordValidation).every(Boolean))
      validationErrors.password = "Password does not meet security requirements";

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        department: formData.department,
        role: formData.role,
        password: formData.password,
      };

      const response = await api.post("/signup", payload);

      if (!response.data?.success) {
        toast.error("Signup failed.");
        setLoading(false);
        return;
      }

      toast.success("Account created successfully!");
      toast.success("Please verify your email before logging in.");

      navigate("/login");
    } catch (err) {
      console.error("Signup error:", err);
      toast.error("Signup failed", {
        description: err.response?.data?.detail || err.message,
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl animate-fadeIn">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Create Your Account</h1>
          <p className="text-slate-400">Join your workspace</p>
        </div>

        <div className="bg-slate-800/40 backdrop-blur-lg p-8 rounded-xl border border-slate-700/60 shadow-xl">

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Name + Email */}
            <div className="grid md:grid-cols-2 gap-6">
              <TextInput
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                icon={<User />}
                error={errors.name}
              />

              <TextInput
                label="Email Address"
                name="email"
                value={formData.email}
                onChange={handleChange}
                icon={<Mail />}
                error={errors.email}
              />
            </div>

            {/* Role + Department */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-200">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger className="bg-slate-900/40 border-slate-600 text-white">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>

                  <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="INTERN">Intern</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>

                {errors.role && <p className="text-red-500 text-sm">{errors.role}</p>}
              </div>

              <TextInput
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                icon={<Users />}
                error={errors.department}
              />
            </div>

            {/* Password */}
            <PasswordInput
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              show={showPassword}
              setShow={setShowPassword}
              error={errors.password}
            />

            {/* Confirm Password */}
            <PasswordInput
              label="Confirm Password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              show={showConfirmPassword}
              setShow={setShowConfirmPassword}
              error={errors.confirmPassword}
            />

            {/* Password Rules */}
            <PasswordRules validation={passwordValidation} />

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

          </form>

          <div className="mt-8 text-center space-y-3">
            <p className="text-slate-500 text-sm">Already registered?</p>
            <button
              onClick={() => navigate("/login")}
              className="text-blue-400 font-medium hover:text-blue-300"
            >
              Sign In
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------ */
/* COMPONENTS (same style as your previous UI) */
/* ------------------------------------------ */

const TextInput = ({ label, icon, error, ...props }) => (
  <div className="space-y-2">
    <Label className="text-slate-200">{label}</Label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
      <Input {...props} className="pl-10 bg-slate-900/40 border-slate-600 text-white" />
    </div>
    {error && <p className="text-red-500 text-sm">{error}</p>}
  </div>
);

const PasswordInput = ({ label, show, setShow, error, ...props }) => (
  <div className="space-y-2">
    <Label className="text-slate-200">{label}</Label>
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <Input {...props} type={show ? "text" : "password"} className="pl-10 pr-10 bg-slate-900/40 border-slate-600 text-white" />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
    {error && <p className="text-red-500 text-sm">{error}</p>}
  </div>
);

const PasswordRules = ({ validation }) => (
  <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-700/60 mt-4">
    <p className="text-slate-300 text-sm font-medium mb-3">Password must contain:</p>
    <div className="space-y-2">
      <Rule label="At least 8 characters" valid={validation.minLength} />
      <Rule label="One uppercase letter" valid={validation.hasUpperCase} />
      <Rule label="One lowercase letter" valid={validation.hasLowerCase} />
      <Rule label="One number" valid={validation.hasNumber} />
      <Rule label="One special character (!@#$%^&*)" valid={validation.hasSpecialChar} />
    </div>
  </div>
);

const Rule = ({ label, valid }) => (
  <div className="flex items-center gap-2">
    <CheckCircle2 className={`w-4 h-4 ${valid ? "text-emerald-500" : "text-slate-600"}`} />
    <span className={`text-sm ${valid ? "text-emerald-500" : "text-slate-400"}`}>
      {label}
    </span>
  </div>
);

export default SignupPage;
