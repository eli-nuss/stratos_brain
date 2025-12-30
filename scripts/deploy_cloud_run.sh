#!/bin/bash
# Stratos Signal Engine - Cloud Run Deployment Script
# Run this in Google Cloud Shell

set -e

# Configuration
PROJECT_ID="gen-lang-client-0259501328"
REGION="us-central1"
REPO_NAME="stratos-engine"
IMAGE_NAME="signal-worker"
WORKER_POOL_NAME="stratos-signal-worker"

echo "=== Stratos Signal Engine Deployment ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Step 1: Clone the repository
echo ""
echo "Step 1: Cloning repository..."
if [ -d "stratos_brain" ]; then
    echo "Repository already exists, pulling latest..."
    cd stratos_brain && git pull && cd ..
else
    git clone https://github.com/eli-nuss/stratos_brain.git
fi

# Step 2: Enable required APIs
echo ""
echo "Step 2: Enabling required APIs..."
gcloud services enable \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    --project=$PROJECT_ID

# Step 3: Create Artifact Registry repository (if not exists)
echo ""
echo "Step 3: Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Stratos Engine container images" \
    --project=$PROJECT_ID 2>/dev/null || echo "Repository already exists"

# Step 4: Configure Docker authentication
echo ""
echo "Step 4: Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# Step 5: Build and push the container image
echo ""
echo "Step 5: Building container image with Cloud Build..."
cd stratos_brain

# Create cloudbuild.yaml for the build
cat > cloudbuild.yaml << 'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO_NAME}/${_IMAGE_NAME}:latest'
      - '-t'
      - '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO_NAME}/${_IMAGE_NAME}:${SHORT_SHA}'
      - '-f'
      - 'docker/Dockerfile'
      - '.'
images:
  - '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO_NAME}/${_IMAGE_NAME}:latest'
  - '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO_NAME}/${_IMAGE_NAME}:${SHORT_SHA}'
substitutions:
  _REGION: us-central1
  _REPO_NAME: stratos-engine
  _IMAGE_NAME: signal-worker
EOF

gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions=SHORT_SHA=$(git rev-parse --short HEAD) \
    --project=$PROJECT_ID

echo ""
echo "=== Build Complete ==="
echo ""
echo "Container image: $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:latest"
echo ""
echo "Next steps:"
echo "1. Go to Cloud Run > Worker pools in the console"
echo "2. Create a new worker pool with:"
echo "   - Image: $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:latest"
echo "   - Name: $WORKER_POOL_NAME"
echo "   - Region: $REGION"
echo "   - Instances: 1"
echo ""
echo "3. Add environment variables (Variables & Secrets tab):"
echo "   - DATABASE_URL: <your Supabase connection string>"
echo "   - OPENAI_API_KEY: <your OpenAI API key>"
echo "   - ENABLE_AI_STAGE: true"
echo "   - LOG_LEVEL: INFO"
