FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir alembic psycopg2-binary sqlalchemy pgvector

COPY . .

CMD ["alembic", "-c", "alembic.ini", "upgrade", "head"]
