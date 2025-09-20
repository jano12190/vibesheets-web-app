#!/bin/bash
set -euo pipefail

##############################################################################
# VibeSheets Deployment Script
# Handles deployment to different environments with proper checks and rollback
##############################################################################

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="vibesheets"
DEFAULT_ENVIRONMENT="staging"
DEFAULT_REGION="us-east-1"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

VibeSheets Deployment Script

OPTIONS:
    -e, --environment ENV    Target environment (staging|production) [default: staging]
    -r, --region REGION      AWS region [default: us-east-1]
    -v, --version VERSION    Version tag to deploy
    -f, --force             Force deployment without confirmations
    --rollback              Rollback to previous version
    --health-check          Run health checks only
    --dry-run              Show what would be deployed without actually deploying
    -h, --help              Show this help message

EXAMPLES:
    $0 --environment staging
    $0 --environment production --version v1.2.3
    $0 --rollback --environment production
    $0 --health-check --environment production

EOF
}

# Parse command line arguments
parse_args() {
    ENVIRONMENT="$DEFAULT_ENVIRONMENT"
    REGION="$DEFAULT_REGION"
    VERSION=""
    FORCE=false
    ROLLBACK=false
    HEALTH_CHECK_ONLY=false
    DRY_RUN=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--region)
                REGION="$2"
                shift 2
                ;;
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            --health-check)
                HEALTH_CHECK_ONLY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check required tools
    local tools=("aws" "docker" "terraform" "kubectl" "jq" "curl")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi

    # Check Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi

    log_success "All prerequisites satisfied"
}

# Get current version
get_current_version() {
    local env="$1"
    
    case "$env" in
        staging)
            local url="https://staging.vibesheets.com/health"
            ;;
        production)
            local url="https://vibesheets.com/health"
            ;;
    esac

    if curl -s -f "$url" | jq -r '.version' 2>/dev/null; then
        return 0
    else
        echo "unknown"
    fi
}

# Build Docker image
build_image() {
    local version="$1"
    
    log_info "Building Docker image for version $version..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would build image $PROJECT_NAME:$version"
        return 0
    fi

    docker build \
        --tag "$PROJECT_NAME:$version" \
        --tag "$PROJECT_NAME:latest" \
        --build-arg VERSION="$version" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        .

    log_success "Image built successfully"
}

# Push image to registry
push_image() {
    local version="$1"
    local registry="ghcr.io/vibesheets"
    
    log_info "Pushing image to registry..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would push image to $registry/$PROJECT_NAME:$version"
        return 0
    fi

    docker tag "$PROJECT_NAME:$version" "$registry/$PROJECT_NAME:$version"
    docker tag "$PROJECT_NAME:latest" "$registry/$PROJECT_NAME:latest"
    
    docker push "$registry/$PROJECT_NAME:$version"
    docker push "$registry/$PROJECT_NAME:latest"

    log_success "Image pushed successfully"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    local env="$1"
    
    log_info "Deploying infrastructure for $env environment..."
    
    cd "$SCRIPT_DIR/Terraform"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy infrastructure"
        terraform init
        terraform plan -var="environment=$env"
        return 0
    fi

    # Initialize Terraform
    terraform init

    # Plan deployment
    terraform plan -var="environment=$env" -out=tfplan

    # Apply if not dry run
    if [[ "$FORCE" == "true" ]] || confirm "Apply Terraform changes?"; then
        terraform apply tfplan
        log_success "Infrastructure deployed successfully"
    else
        log_warning "Infrastructure deployment cancelled"
        return 1
    fi
}

# Deploy application
deploy_application() {
    local env="$1"
    local version="$2"
    local registry="ghcr.io/vibesheets"
    
    log_info "Deploying application version $version to $env..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy application $version to $env"
        return 0
    fi

    case "$env" in
        staging)
            deploy_to_staging "$registry/$PROJECT_NAME:$version"
            ;;
        production)
            deploy_to_production "$registry/$PROJECT_NAME:$version"
            ;;
    esac
}

# Deploy to staging environment
deploy_to_staging() {
    local image="$1"
    
    log_info "Deploying to staging environment..."
    
    # Update ECS service (if using ECS)
    aws ecs update-service \
        --region "$REGION" \
        --cluster "$PROJECT_NAME-staging-cluster" \
        --service "$PROJECT_NAME-staging-service" \
        --force-new-deployment \
        --task-definition "$PROJECT_NAME-staging:latest"

    # Or update Kubernetes deployment (if using K8s)
    # kubectl set image deployment/$PROJECT_NAME $PROJECT_NAME="$image" -n staging

    log_success "Staging deployment completed"
}

# Deploy to production environment  
deploy_to_production() {
    local image="$1"
    
    log_info "Deploying to production environment..."
    
    # Get current deployment for rollback capability
    local current_task_def=$(aws ecs describe-services \
        --region "$REGION" \
        --cluster "$PROJECT_NAME-production-cluster" \
        --services "$PROJECT_NAME-production-service" \
        --query 'services[0].taskDefinition' \
        --output text)
    
    echo "$current_task_def" > "$SCRIPT_DIR/.last-production-task-def"
    
    # Update ECS service
    aws ecs update-service \
        --region "$REGION" \
        --cluster "$PROJECT_NAME-production-cluster" \
        --service "$PROJECT_NAME-production-service" \
        --force-new-deployment \
        --task-definition "$PROJECT_NAME-production:latest"

    log_success "Production deployment completed"
}

# Run health checks
run_health_checks() {
    local env="$1"
    local max_attempts=30
    local attempt=1
    
    case "$env" in
        staging)
            local health_url="https://staging.vibesheets.com/health"
            local api_url="https://staging-api.vibesheets.com/auth"
            ;;
        production)
            local health_url="https://vibesheets.com/health"
            local api_url="https://api.vibesheets.com/auth"
            ;;
    esac

    log_info "Running health checks for $env environment..."
    
    # Wait for deployment to complete
    sleep 30
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts..."
        
        # Check frontend health
        if curl -s -f "$health_url" > /dev/null; then
            log_success "Frontend health check passed"
            
            # Check API health
            if curl -s -f "$api_url" > /dev/null; then
                log_success "API health check passed"
                return 0
            else
                log_warning "API health check failed"
            fi
        else
            log_warning "Frontend health check failed"
        fi
        
        ((attempt++))
        sleep 10
    done
    
    log_error "Health checks failed after $max_attempts attempts"
    return 1
}

# Rollback deployment
rollback() {
    local env="$1"
    
    log_warning "Rolling back $env environment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rollback $env environment"
        return 0
    fi

    if [[ "$env" == "production" ]] && [[ -f "$SCRIPT_DIR/.last-production-task-def" ]]; then
        local last_task_def=$(cat "$SCRIPT_DIR/.last-production-task-def")
        
        aws ecs update-service \
            --region "$REGION" \
            --cluster "$PROJECT_NAME-production-cluster" \
            --service "$PROJECT_NAME-production-service" \
            --task-definition "$last_task_def"
            
        log_success "Rollback completed"
    else
        log_error "No previous deployment found for rollback"
        return 1
    fi
}

# Confirmation prompt
confirm() {
    local message="$1"
    
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    read -p "$message (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Send deployment notification
send_notification() {
    local env="$1"
    local version="$2"
    local status="$3"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local emoji="✅"
        local color="good"
        
        if [[ "$status" != "success" ]]; then
            emoji="❌"
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"text\": \"$emoji VibeSheets deployment to $env $status\",
                    \"fields\": [{
                        \"title\": \"Version\",
                        \"value\": \"$version\",
                        \"short\": true
                    }, {
                        \"title\": \"Environment\",
                        \"value\": \"$env\",
                        \"short\": true
                    }]
                }]
            }" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# Main deployment function
main() {
    log_info "Starting VibeSheets deployment process..."
    
    parse_args "$@"
    
    # Show configuration
    log_info "Configuration:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Region: $REGION"
    log_info "  Version: ${VERSION:-latest}"
    log_info "  Force: $FORCE"
    log_info "  Rollback: $ROLLBACK"
    log_info "  Health Check Only: $HEALTH_CHECK_ONLY"
    log_info "  Dry Run: $DRY_RUN"
    echo

    # Run health checks only if requested
    if [[ "$HEALTH_CHECK_ONLY" == "true" ]]; then
        run_health_checks "$ENVIRONMENT"
        exit $?
    fi

    # Handle rollback
    if [[ "$ROLLBACK" == "true" ]]; then
        if confirm "Are you sure you want to rollback $ENVIRONMENT?"; then
            rollback "$ENVIRONMENT"
            run_health_checks "$ENVIRONMENT"
            send_notification "$ENVIRONMENT" "rollback" "success"
        fi
        exit $?
    fi

    # Check prerequisites
    check_prerequisites

    # Get version
    if [[ -z "$VERSION" ]]; then
        VERSION=$(git describe --tags --always --dirty)
        log_info "Using version from git: $VERSION"
    fi

    # Get current version for comparison
    CURRENT_VERSION=$(get_current_version "$ENVIRONMENT")
    log_info "Current version in $ENVIRONMENT: $CURRENT_VERSION"

    # Confirm deployment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_warning "You are about to deploy to PRODUCTION!"
        if ! confirm "Continue with production deployment?"; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi

    # Build and deploy
    build_image "$VERSION"
    push_image "$VERSION"
    deploy_infrastructure "$ENVIRONMENT"
    deploy_application "$ENVIRONMENT" "$VERSION"
    
    # Run health checks
    if run_health_checks "$ENVIRONMENT"; then
        log_success "Deployment completed successfully!"
        send_notification "$ENVIRONMENT" "$VERSION" "success"
    else
        log_error "Deployment failed health checks"
        send_notification "$ENVIRONMENT" "$VERSION" "failed"
        
        if [[ "$ENVIRONMENT" == "production" ]]; then
            if confirm "Health checks failed. Rollback?"; then
                rollback "$ENVIRONMENT"
            fi
        fi
        exit 1
    fi
}

# Trap errors and cleanup
trap 'log_error "Deployment failed"; exit 1' ERR

# Run main function
main "$@"