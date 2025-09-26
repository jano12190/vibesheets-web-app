#!/bin/bash

# Build script for Node.js Lambda functions
set -e

echo "Building Node.js Lambda functions..."

# Create lambda_packages directory if it doesn't exist
mkdir -p lambda_packages

# Install dependencies in lambda_functions directory
cd lambda_functions
echo "Installing dependencies..."
npm install --production

# Function to create lambda package
create_lambda_package() {
    local func_name=$1
    local package_name="${func_name}_nodejs"
    
    echo "Creating package for ${func_name}..."
    
    # Create temporary directory
    local temp_dir="../lambda_packages/temp_${package_name}"
    mkdir -p "$temp_dir"
    
    # Copy function file and dependencies
    cp "${func_name}.js" "$temp_dir/"
    cp -r node_modules "$temp_dir/" 2>/dev/null || true
    cp -r utils "$temp_dir/" 2>/dev/null || true
    
    # Create zip file
    cd "$temp_dir"
    zip -r "../${package_name}.zip" . -q
    cd - > /dev/null
    
    # Cleanup temp directory
    rm -rf "$temp_dir"
    
    echo "✅ Created ${package_name}.zip"
}

# Create packages for each function
create_lambda_package "auth_config"
create_lambda_package "clock_status"
create_lambda_package "clock_in_out"
create_lambda_package "get_timesheets"
create_lambda_package "update_timesheet"
create_lambda_package "export_timesheet"
create_lambda_package "get_projects"
create_lambda_package "create_project"

cd ..

echo "✅ All Node.js Lambda packages built successfully!"