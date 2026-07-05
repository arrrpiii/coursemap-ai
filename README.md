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
