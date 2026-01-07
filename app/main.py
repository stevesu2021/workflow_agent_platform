from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.core.database import init_db
from app.api import agents, runs, ai_resources, knowledge

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

app.include_router(agents.router, prefix="/agents", tags=["agents"])
app.include_router(runs.router, prefix="/agents", tags=["runs"])
app.include_router(ai_resources.router, prefix="/ai-resources", tags=["ai-resources"])
app.include_router(knowledge.router, prefix="/knowledge-bases", tags=["knowledge-bases"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AgentFlow Studio API is running"}
