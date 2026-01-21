from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import init_db
from app.api import agents, runs, ai_resources, knowledge, tools, mcp
# Import all models to ensure they are registered with SQLModel
import app.models.agent
import app.models.agent_run_log
import app.models.ai_resource
import app.models.knowledge
import app.models.tool

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="AgentFlow Studio",
    description="Backend API for AgentFlow Studio",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/agents", tags=["agents"])
app.include_router(runs.router, prefix="/agents", tags=["runs"])
app.include_router(ai_resources.router, prefix="/ai-resources", tags=["ai-resources"])
app.include_router(knowledge.router, prefix="/knowledge-bases", tags=["knowledge-bases"])
app.include_router(tools.router, prefix="/tools", tags=["tools"])
app.include_router(mcp.router, prefix="/mcp", tags=["mcp"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AgentFlow Studio API is running"}
