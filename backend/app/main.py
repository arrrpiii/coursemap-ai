"""FastAPI application entry point for CourseMap AI."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import close_db, get_db
from app.routes import ai as ai_routes
from app.routes import auth as auth_routes
from app.routes import chat as chat_routes
from app.routes import courses as course_routes
from app.routes import nodes as node_routes


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Warm the database connection so failures surface at startup
    get_db()
    yield
    await close_db()


app = FastAPI(title="CourseMap AI", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(auth_routes.router)
app.include_router(course_routes.router)
app.include_router(node_routes.router)
app.include_router(chat_routes.router)
app.include_router(ai_routes.router)
