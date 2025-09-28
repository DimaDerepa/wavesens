#!/bin/bash

echo "Starting WaveSens Backend..."
echo "PORT: $PORT"
echo "DATABASE_URL set: $([[ -n $DATABASE_URL ]] && echo "yes" || echo "no")"

# Export port for the application
export PORT=${PORT:-8000}

echo "Starting uvicorn on port $PORT..."
exec uvicorn main:app --host 0.0.0.0 --port $PORT --log-level info