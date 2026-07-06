# CourseMap AI

CourseMap AI is a full-stack web app that turns a course title and syllabus
into a navigable, AI-assisted learning map.

- **Frontend**: React + React Router + Vite (plain CSS, native `fetch`)
- **Backend**: FastAPI + Motor (MongoDB) + Google Gemini 2.5 Flash
- **Database**: MongoDB only — no vector DB, no embeddings, no RAG

## Features

- Generate a 2-level course tree (course → topics → subtopics) from a syllabus
- Mark each node as `pending`, `learning`, or `completed`
- Save professor notes per node
- AI explanation of a node using syllabus + saved notes
- AI question generator with difficulty + type controls
- Full-course sample question paper generator

## Project layout

```
.
├── backend/             # FastAPI app
│   ├── app/
│   │   ├── ai_flows/    # Direct Gemini calls (one module per capability)
│   │   ├── routes/      # FastAPI routers (auth, courses, nodes, ai, chat)
│   │   ├── services/    # Mongo + Gemini helpers
│   │   ├── models/      # Pydantic request/response shapes
│   │   ├── main.py
│   │   └── config.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/            # Vite + React app
│   ├── src/
│   │   ├── pages/       # Route-level pages (Home, CourseTree, Questions, ...)
│   │   ├── components/  # Reusable UI (Sidebar, ChatPanel, AiOutputPanel, ...)
│   │   ├── contexts/    # AuthProvider
│   │   ├── api/         # Fetch wrappers for the backend
│   │   └── utils/       # Tiny zero-dep Markdown renderer
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json      # /api/* proxy + SPA rewrite for Vercel
└── README.md
```
