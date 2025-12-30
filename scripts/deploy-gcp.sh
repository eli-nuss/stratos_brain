#!/bin/bash
# Deploy Stratos Signal Engine Worker to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="stratos-engine-worker"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying Stratos Signal Engine to GCP Cloud Run${NC}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null 2>&1; then
    echo -e "${RED}Error: Not authenticated with gcloud. Run 'gcloud auth login'${NC}"
    exit 1
fi

# Set project
gcloud config set project ${PROJECT_ID}

# Build and push Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t ${IMAGE_NAME}:latest -f docker/Dockerfile .

echo -e "${YELLOW}Pushing to Container Registry...${NC}"
docker push ${IMAGE_NAME}:latest

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME}:latest \
    --region ${REGION} \
    --platform managed \
    --no-allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --min-instances 1 \
    --max-instances 3 \
    --set-env-vars "LOG_FORMAT=json,LOG_LEVEL=INFO" \
    --set-secrets "SUPABASE_URL=stratos-supabase-url:latest" \
    --set-secrets "SUPABASE_SERVICE_KEY=stratos-supabase-key:latest" \
    --set-secrets "SUPABASE_DB_HOST=stratos-db-host:latest" \
    --set-secrets "SUPABASE_DB_PASSWORD=stratos-db-password:latest" \
    --set-secrets "OPENAI_API_KEY=stratos-openai-key:latest"

echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "To view logs:"
echo "  gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo ""
echo "To check status:"
echo "  gcloud run services describe ${SERVICE_NAME} --region ${REGION}"
