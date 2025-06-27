#!/bin/bash

# VibeSheets Deployment Script
# This script deploys the updated Lambda functions and frontend

echo "🚀 Starting VibeSheets deployment..."

# Check if we're in the right directory
if [ ! -d "Terraform" ] || [ ! -d "Backend" ] || [ ! -d "Frontend" ]; then
    echo "❌ Error: Please run this script from the VibeSheets root directory"
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Error: Terraform is not installed. Please install Terraform first."
    echo "   Visit: https://learn.hashicorp.com/tutorials/terraform/install-cli"
    exit 1
fi

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed. Please install AWS CLI first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ Error: AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Step 1: Deploy infrastructure
echo ""
echo "📦 Step 1: Deploying infrastructure with Terraform..."
cd Terraform

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    echo "   Initializing Terraform..."
    terraform init
fi

# Plan the deployment
echo "   Planning deployment..."
terraform plan -out=tfplan

# Ask for confirmation
echo ""
read -p "📋 Do you want to apply these changes? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    rm -f tfplan
    exit 1
fi

# Apply the changes
echo "   Applying Terraform changes..."
terraform apply tfplan
rm -f tfplan

if [ $? -ne 0 ]; then
    echo "❌ Terraform deployment failed"
    exit 1
fi

echo "✅ Infrastructure deployed successfully"

# Get outputs
BUCKET_NAME=$(terraform output -raw s3_bucket_name 2>/dev/null)
TIMESHEET_API_URL=$(terraform output -raw timesheet_api_invoke_url 2>/dev/null)

cd ..

# Step 2: Upload frontend files
echo ""
echo "📁 Step 2: Uploading frontend files to S3..."

if [ -n "$BUCKET_NAME" ]; then
    aws s3 sync Frontend/ s3://$BUCKET_NAME/ --delete
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend files uploaded successfully"
    else
        echo "❌ Frontend upload failed"
        exit 1
    fi
else
    echo "⚠️  Could not determine S3 bucket name. Please upload frontend manually:"
    echo "   aws s3 sync Frontend/ s3://YOUR_BUCKET_NAME/ --delete"
fi

# Step 3: Display deployment info
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure your Auth0 and OAuth secrets in AWS Secrets Manager"
echo "2. Update your domain's nameservers (if using custom domain)"
echo "3. Test your application"
echo ""

if [ -n "$TIMESHEET_API_URL" ]; then
    echo "🔧 For development/testing, set this API URL in localStorage:"
    echo "   localStorage.setItem('timesheet_api_url', '$TIMESHEET_API_URL');"
    echo ""
fi

echo "📊 View full deployment details:"
echo "   cd Terraform && terraform output"
echo ""
echo "🌐 Your application should be accessible at your configured domain!"

# Step 4: Optional CloudFront invalidation
if [ -n "$BUCKET_NAME" ]; then
    DISTRIBUTION_ID=$(cd Terraform && terraform output -raw cloudfront_distribution_id 2>/dev/null)
    if [ -n "$DISTRIBUTION_ID" ]; then
        echo ""
        read -p "🔄 Invalidate CloudFront cache? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "   Invalidating CloudFront cache..."
            aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
            echo "✅ CloudFront cache invalidated"
        fi
    fi
fi

echo ""
echo "✨ Deployment complete! Your VibeSheets application is ready to use."