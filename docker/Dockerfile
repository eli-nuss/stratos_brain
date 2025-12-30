# Stratos Signal Engine Worker
# Multi-stage build for minimal production image

# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 worker

# Copy Python packages from builder
COPY --from=builder /root/.local /home/worker/.local

# Copy application code
COPY src/ ./src/

# Set ownership
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

# Add local packages to path
ENV PATH=/home/worker/.local/bin:$PATH
ENV PYTHONPATH=/app/src

# Health check - simple Python import check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)" || exit 1

# Run the worker
CMD ["python", "-m", "stratos_engine.worker"]
