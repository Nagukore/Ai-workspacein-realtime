# server.py
import os
import sys
import logging
from datetime import datetime
from typing import Optional

import bcrypt
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client


# ===========================================================
# ENVIRONMENT VARIABLES (ONE SUPABASE PROJECT ONLY)
# ===========================================================
SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://lqfxbenyazhbxgnikmvu.supabase.co"   # USE ANY ONE PROJECT — YOU SAID NOW IT’S SAME PROJECT
)

SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZnhiZW55YXpoYnhnbmlrbXZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM4NTYzMCwiZXhwIjoyMDc2OTYxNjMwfQ.SV2XmwMKU4nWiYObEUnJtxgLyD89aXiHpfD8n-zOreU"
)


# ===========================================================
# LOGGING
# ===========================================================
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("ai-workspace-backend")


# ===========================================================
# CREATE ONE SUPABASE CLIENT
# ===========================================================
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("Supabase client initialized (single project).")
except Exception as e:
    logger.exception("Failed to initialize Supabase client.")
    raise


# ===========================================================
# FASTAPI INITIALIZATION
# ===========================================================
app = FastAPI(title="AI Workspace Backend", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================
# PYDANTIC MODELS
# ===========================================================
class SignupData(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "EMPLOYEE"
    department: Optional[str] = None


class LoginData(BaseModel):
    email: str
    password: str


class TaskData(BaseModel):
    title: str
    description: Optional[str] = ""
    status: Optional[str] = "Pending"
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None


class TranscriptData(BaseModel):
    meeting_name: str
    transcript: str
    summary: Optional[str] = ""
    tasks: Optional[str] = ""
    pending_tasks: Optional[str] = ""


# ===========================================================
# CREATE SUPABASE AUTH USER
# ===========================================================
def create_supabase_auth_user(email: str, password: str, user_metadata=None) -> dict:
    admin_url = SUPABASE_URL.rstrip("/") + "/auth/v1/admin/users"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": user_metadata or {},
    }

    logger.info("Creating Supabase auth user: %s", email)
    resp = requests.post(admin_url, json=body, headers=headers, timeout=15)

    if resp.status_code not in (200, 201):
        try:
            msg = resp.json().get("message")
        except:
            msg = resp.text
        raise HTTPException(status_code=500, detail=f"Supabase auth error: {msg}")

    return resp.json()


# ===========================================================
# BASE ENDPOINT
# ===========================================================
@app.get("/")
def root():
    return {"status": "ok", "message": "AI Workspace Backend Running"}


# ===========================================================
# SIGNUP
# ===========================================================
@app.post("/signup")
def signup_user(data: SignupData):
    try:
        logger.info("Signup attempt for %s", data.email)

        existing = supabase.table("employee").select("id").eq("email", data.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="User already exists")

        created_user = create_supabase_auth_user(
            email=data.email,
            password=data.password,
            user_metadata={"name": data.name, "role": data.role},
        )

        supa_user_id = created_user.get("id")

        hashed_pw = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

        payload = {
            "name": data.name,
            "email": data.email,
            "password": hashed_pw,
            "role": data.role,
            "department": data.department,
            "supabase_user_id": supa_user_id,
            "createdAt": datetime.utcnow().isoformat(),
        }

        resp = supabase.table("employee").insert(payload).execute()
        return {"success": True, "user": resp.data}

    except Exception as e:
        logger.exception("Signup error")
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================
# LOGIN
# ===========================================================
@app.post("/login")
def login_user(data: LoginData):
    try:
        logger.info("Login attempt: %s", data.email)

        result = supabase.table("employee").select("*").eq("email", data.email).execute()
        rows = result.data

        if not rows:
            raise HTTPException(status_code=404, detail="User not found")

        user = rows[0]
        stored_hash = user["password"]

        if not stored_hash.startswith("$2"):
            if stored_hash == data.password:
                new_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
                supabase.table("employee").update({"password": new_hash}).eq("email", data.email).execute()
                stored_hash = new_hash
            else:
                raise HTTPException(status_code=401, detail="Invalid credentials")

        if not bcrypt.checkpw(data.password.encode(), stored_hash.encode()):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user.pop("password", None)

        return {"success": True, "user": user}

    except Exception as e:
        logger.exception("Login error")
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================
# TASK MANAGEMENT (SAME PROJECT)
# ===========================================================
@app.post("/tasks")
def create_task(data: TaskData):
    try:
        logger.info("Creating task: %s", data.title)

        payload = {
            "user_id": data.assigned_to,
            "title": data.title,
            "description": data.description or "",
            "status": data.status or "Pending",
            "due_date": data.due_date,
            "created_at": datetime.utcnow().isoformat(),
        }

        resp = supabase.table("tasks").insert(payload).execute()
        return {"success": True, "data": resp.data}

    except Exception as e:
        logger.exception("Create Task error")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tasks")
def get_all_tasks():
    try:
        resp = (
            supabase.table("tasks")
            .select("id, user_id, title, description, status, due_date, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        return {"success": True, "data": resp.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/tasks/{task_id}")
def update_task(task_id: str, data: TaskData):
    try:
        updates = {k: v for k, v in data.dict().items() if v is not None}
        resp = supabase.table("tasks").update(updates).eq("id", task_id).execute()
        return {"success": True, "data": resp.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================
# MEETING TRANSCRIPTS + SUMMARIES (Unified)
# ===========================================================
@app.post("/meeting-transcript")
def upload_transcript(data: TranscriptData):
    try:
        payload = {
            "meeting_name": data.meeting_name,
            "transcript": data.transcript,
            "summary": data.summary,
            "tasks": data.tasks,
            "pending_tasks": data.pending_tasks,
            "created_at": datetime.utcnow().isoformat(),
        }

        resp = supabase.table("transcripts").insert(payload).execute()
        return {"success": True, "data": resp.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/meeting-transcript")
def get_all_transcripts():
    try:
        resp = (
            supabase.table("transcripts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return {"success": True, "data": resp.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/meeting-summary")
def get_meeting_summary():
    try:
        resp = (
            supabase.table("transcripts")
            .select("id, meeting_name, summary, tasks, pending_tasks, created_at")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        return {"success": True, "data": resp.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
