from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import settings

# pool_pre_ping: Neon closes idle connections; without it the first request after a
# quiet spell fails with "SSL connection has been closed unexpectedly".
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
