#!/bin/bash

# Build Lambda deployment packages with dependencies

LAMBDA_FUNCTIONS=("auth_config" "clock_in_out" "clock_status" "get_timesheets" "update_timesheet" "export_timesheet")

for func in "${LAMBDA_FUNCTIONS[@]}"; do
    echo "Building $func..."
    
    # Create temp directory
    temp_dir="/tmp/${func}_build"
    rm -rf "$temp_dir"
    mkdir -p "$temp_dir"
    
    # Copy function code
    cp "lambda_functions/${func}.py" "$temp_dir/lambda_function.py"
    
    # Install dependencies
    if [ -f "lambda_functions/requirements.txt" ]; then
        pip3 install -r lambda_functions/requirements.txt -t "$temp_dir" --quiet
    fi
    
    # Create zip file
    cd "$temp_dir"
    zip -r "../${func}.zip" . > /dev/null
    cd - > /dev/null
    
    # Move to current directory
    mv "/tmp/${func}.zip" "${func}.zip"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    echo "Built ${func}.zip"
done

echo "All Lambda packages built successfully!"