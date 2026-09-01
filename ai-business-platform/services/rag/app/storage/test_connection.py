from sqlalchemy import text

from app.storage.database import engine


with engine.connect() as connection:
    result = connection.execute(text("SELECT version();"))
    print(result.scalar())
