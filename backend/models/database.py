"""SQLite + SQLAlchemy setup and the FastAPI DB dependency."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

_is_sqlite = DATABASE_URL.startswith("sqlite")
# check_same_thread is a SQLite-only quirk; timeout sets the busy-wait so
# concurrent app + SMS writes wait instead of erroring with "database is locked".
_connect_args = {"check_same_thread": False, "timeout": 10} if _is_sqlite else {}
# A roomier pool so a concurrency burst (app + SMS at once) doesn't starve on
# connection checkout.
_pool = {"pool_size": 20, "max_overflow": 30} if _is_sqlite else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, **_pool)

if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")    # readers don't block the single writer
        cur.execute("PRAGMA busy_timeout=8000")   # wait up to 8s for the write lock
        cur.execute("PRAGMA synchronous=NORMAL")  # safe under WAL, much faster
        cur.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables. Import models first so they register on Base.metadata."""
    from models import score_record, session, user, video_record  # noqa: F401

    Base.metadata.create_all(bind=engine)
