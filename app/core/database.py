from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from sqlmodel import SQLModel
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)

async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

def migrate_knowledge_base_type_column(conn):
    """Add type column to knowledge_bases table if it doesn't exist"""
    try:
        # Check if column exists
        result = conn.execute(text("PRAGMA table_info(knowledge_bases)"))
        columns = result.fetchall()
        column_names = [col[1] for col in columns]

        if 'type' not in column_names:
            logger.info("Adding 'type' column to knowledge_bases table")
            conn.execute(text(
                "ALTER TABLE knowledge_bases ADD COLUMN type VARCHAR NOT NULL DEFAULT 'text'"
            ))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_knowledge_bases_type ON knowledge_bases (type)"))
            logger.info("Successfully added 'type' column to knowledge_bases table")
        else:
            logger.info("'type' column already exists in knowledge_bases table")
    except Exception as e:
        logger.error(f"Error migrating knowledge_bases table: {e}")
        raise

def migrate_document_metadata_column(conn):
    """Add metadata column to documents table if it doesn't exist"""
    try:
        # Check if column exists
        result = conn.execute(text("PRAGMA table_info(documents)"))
        columns = result.fetchall()
        column_names = [col[1] for col in columns]

        if 'metadata' not in column_names:
            logger.info("Adding 'metadata' column to documents table")
            # SQLite doesn't support JSON type directly, use TEXT
            conn.execute(text(
                "ALTER TABLE documents ADD COLUMN metadata TEXT"
            ))
            logger.info("Successfully added 'metadata' column to documents table")
        else:
            logger.info("'metadata' column already exists in documents table")
    except Exception as e:
        logger.error(f"Error migrating documents table: {e}")
        raise

async def init_db():
    async with engine.begin() as conn:
        # Run migrations first
        await conn.run_sync(migrate_knowledge_base_type_column)
        await conn.run_sync(migrate_document_metadata_column)
        # Then create all tables (this will skip existing tables)
        await conn.run_sync(SQLModel.metadata.create_all)

async def get_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

# Export session factory for direct usage in services
def async_session_factory():
    return async_session_maker()
