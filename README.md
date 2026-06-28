# CourseMap AI

CourseMap AI is a full-stack web app that turns a course title and syllabus
into a navigable, AI-assisted learning map.

- **Frontend**: React + React Router + Vite (plain CSS, native `fetch`)
- **Backend**: FastAPI + Motor (MongoDB) + LangGraph + Google Gemini 2.5 Flash
- **Database**: MongoDB only — no vector DB, no embeddings, no RAG

## Features

- Generate a 2-level course tree (course → topics → subtopics) from a syllabus
- Mark each node as `pending`, `learning`, or `completed`
- Save professor notes per node (single editable note per node)
- AI explanation of a node using syllabus + saved notes
- AI-generated notes (4 styles: simple, detailed, exam-focused, bullet-points)
- AI question generator with difficulty + type controls
- Full-course sample question paper generator

## Project layout

```
.
├── backend/        # FastAPI app
│   ├── app/
│   ├── requirements.txt
│   └── .env.example
├── frontend/       # Vite + React app
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- A running MongoDB instance (local or Atlas)
- A Google Gemini API key

## 1. Run MongoDB locally

Install MongoDB Community Edition and start the daemon:

```bash
# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Linux (Debian/Ubuntu)
sudo apt-get install -y mongodb-org
sudo systemctl start mongod

# Windows
# Download from https://www.mongodb.com/try/download/community and run the installer.
# After installation, start the service:
net start MongoDB
```

Confirm it's running:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
# or
mongo --eval "db.runCommand({ ping: 1 })"
```

The default URI is `mongodb://localhost:27017`. If you use a different host,
set `MONGODB_URI` in `backend/.env`.

You can also use a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
and paste the connection string into `MONGODB_URI`.

## 2. Backend setup

```bash
cd backend
python -m venv .venv
# activate the venv
# Windows (Git Bash):
source .venv/Scripts/activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY (and MONGODB_URI if not using localhost)
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/api/health
# -> {"status": "ok"}
```

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app at <http://localhost:5173> and proxies `/api/*` to
`http://localhost:8000`.

## 4. End-to-end usage

1. Open <http://localhost:5173>.
2. Click **+ New Course**.
3. Enter a course title (e.g. "Machine Learning") and paste a syllabus.
4. Wait for the AI to build the topic/subtopic tree.
5. Click any node to:
   - Save professor notes
   - Ask AI for an explanation
   - Generate AI notes in a chosen style
   - Open the Questions page to generate MCQ / short / long answer / numerical / case study questions
6. Click the root course node to open the course-level workspace and
   generate a full sample question paper covering the entire syllabus.

## API route summary

All routes are prefixed with `/api`.

| Method | Path                                                  | Description |
|--------|-------------------------------------------------------|-------------|
| GET    | `/api/health`                                         | Health check |
| POST   | `/api/courses`                                        | Create a course and generate its tree |
| GET    | `/api/courses`                                        | List all courses |
| GET    | `/api/courses/{courseId}/tree`                        | Get the nested course tree |
| GET    | `/api/courses/{courseId}/nodes/{nodeId}`              | Node workspace (notes, parent, recent outputs) |
| PATCH  | `/api/courses/{courseId}/nodes/{nodeId}/status`       | Update node status |
| POST   | `/api/courses/{courseId}/nodes/{nodeId}/notes`        | Save / update student note |
| POST   | `/api/courses/{courseId}/nodes/{nodeId}/explain`      | AI explanation of a node |
| POST   | `/api/courses/{courseId}/nodes/{nodeId}/generate-notes` | AI notes for a node |
| POST   | `/api/courses/{courseId}/nodes/{nodeId}/questions`   | AI question generator |
| POST   | `/api/courses/{courseId}/sample-paper`                | Full-course sample paper |

## MongoDB collections

The app uses four collections — no migrations required:

- `courses` — one document per course
- `course_nodes` — one document per root / topic / subtopic
- `node_notes` — student (`source: "student"`) and AI (`source: "ai"`) notes
- `ai_outputs` — explanations, generated notes, questions, sample papers

You can inspect data with `mongosh`:

```bash
mongosh coursemap_ai
> db.courses.find().pretty()
> db.course_nodes.find().pretty()
> db.node_notes.find().pretty()
> db.ai_outputs.find().pretty()
```

## Notes & limitations (MVP)

- No authentication, no multi-user separation
- No file upload, PDF export, or streaming responses
- One editable student note per node; multiple AI notes allowed
- The Gemini model used is `gemini-2.5-flash` (override via `GEMINI_MODEL` in `.env`)
- The course tree is strictly 3 levels (course → topic → subtopic)
- LangGraph flows are intentionally simple linear chains:
  `prepare_input → call_gemini → validate_output → END`

## Deployment

The project is split across two platforms from a single GitHub repo:

- **Backend → Render** (Python Web Service) — holds the Gemini API key and MongoDB credentials as server-side env vars.
- **Frontend → Vercel** (static site) — pure static build that calls the backend over HTTPS.

This split exists so that the Gemini key never enters the public GitHub repo.

### Prerequisites

- A GitHub account with this repo pushed.
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster.
- A Google Gemini API key.
- Accounts on [Render](https://render.com) and [Vercel](https://vercel.com) (free tiers are fine).

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<you>/coursemap-ai.git
git push -u origin main
```

**Before pushing, double-check no secrets are committed:**

```bash
git ls-files | grep -E '\.env($|\.)'   # should print nothing
```

### 2. Backend on Render

The repo includes a `render.yaml` Blueprint at the root, so setup is one click:

1. Render dashboard → **New** → **Blueprint**.
2. Connect the GitHub repo. Render detects `render.yaml` and pre-fills the service.
3. Click **Apply**. Render creates the Web Service and starts the first build.
4. Open the new service → **Environment** tab and set the three required secrets:
   - `GOOGLE_API_KEY` — your Gemini key.
   - `MONGODB_URI` — Atlas connection string (format: `mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority`).
   - `FRONTEND_URL` — *temporarily* set this to `https://placeholder.com` for now; you'll replace it after the Vercel deploy in step 3.
   - `JWT_SECRET` is auto-generated by Render (`generateValue: true` in `render.yaml`) — do not override it.

5. Wait for the first deploy to finish, then verify the health endpoint:

   ```bash
   curl https://<your-service>.onrender.com/api/health
   # -> {"status":"ok"}
   ```

   First request after a quiet period may take 15–45s (Render free tier sleeps after 15 min of inactivity).

### 3. Frontend on Vercel

1. Vercel dashboard → **Add New** → **Project** → import the same GitHub repo.
2. In the project setup screen:
   - **Root Directory**: click **Edit** and set it to `frontend`.
   - **Framework Preset**: Vite (auto-detected).
3. Expand **Environment Variables** and add:
   - `VITE_API_URL` = `https://<your-service>.onrender.com` (the Render URL from step 2, no trailing slash).
4. Click **Deploy**. Vercel builds and deploys in ~1 minute.
5. Copy the deployed Vercel URL (e.g. `https://coursemap-ai.vercel.app`).

### 4. Wire CORS

Go back to Render → your service → **Environment** → edit `FRONTEND_URL` to the Vercel URL from step 3 → save. Render redeploys automatically.

This step must come **after** the Vercel deploy, otherwise the first browser request will be blocked by CORS.

### 5. Verify end-to-end

```bash
# Backend health
curl https://<your-service>.onrender.com/api/health

# CORS preflight from your Vercel origin
curl -i -X OPTIONS https://<your-service>.onrender.com/api/auth/login \
  -H "Origin: https://<your-app>.vercel.app" \
  -H "Access-Control-Request-Method: POST"
# Expect: access-control-allow-origin: https://<your-app>.vercel.app
```

Open the Vercel URL in a browser, register an account, create a course, and confirm the AI features work.

### Cost & limits (free tiers)

- **Render**: 750 hours/month of Web Service runtime. The service sleeps after 15 min of inactivity; the first request after a sleep incurs a 15–45s cold start. Upgrade to the $7/month plan to disable sleeping.
- **Vercel**: 100 GB bandwidth/month, generous build minutes. No cold starts (static assets served from CDN).
- **MongoDB Atlas**: 512 MB storage on the M0 free tier — plenty for a study project.

### Local development vs production

The frontend reads `VITE_API_URL` at build time. To run locally against a different backend:

```bash
# frontend/.env.local (gitignored)
VITE_API_URL=http://localhost:8000   # or your staging backend
npm run dev
```

Without `.env.local`, the dev server falls back to `/api`, which Vite proxies to `http://localhost:8000` via `vite.config.js`.
