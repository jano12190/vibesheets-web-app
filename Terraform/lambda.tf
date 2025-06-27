# Lambda Functions Configuration

# Create zip files for Lambda functions
data "archive_file" "auth_config_zip" {
  type        = "zip"
  output_path = "auth_config.zip"
  
  source {
    content = <<EOF
import json
import boto3
from botocore.exceptions import ClientError
import os

def lambda_handler(event, context):
    # Get allowed origins from environment variable
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', '').split(',')
    origin = event.get('headers', {}).get('Origin') or event.get('headers', {}).get('origin')
    
    # Determine CORS origin
    cors_origin = '*'
    if origin and origin in allowed_origins:
        cors_origin = origin
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': cors_origin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    try:
        # Get region from environment or default to us-east-1
        region = os.environ.get('AWS_REGION', 'us-east-1')
        secrets_client = boto3.client('secretsmanager', region_name=region)
        
        # Get Auth0 credentials
        auth0_response = secrets_client.get_secret_value(
            SecretId='${var.app_name}/auth0-credentials'
        )
        auth0_data = json.loads(auth0_response['SecretString'])
        
        # Get OAuth credentials
        oauth_response = secrets_client.get_secret_value(
            SecretId='${var.app_name}/oauth-credentials'
        )
        oauth_data = json.loads(oauth_response['SecretString'])
        
        # Prepare configuration response
        config = {
            'auth0_domain': auth0_data.get('auth0_domain'),
            'auth0_client_id': auth0_data.get('auth0_client_id'),
            'auth0_audience': auth0_data.get('auth0_audience'),
            'google_client_id': oauth_data.get('google_client_id')
        }
        
        # Validate that we have the required configuration
        missing_fields = [key for key, value in config.items() if not value or value.startswith('placeholder')]
        if missing_fields:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Configuration incomplete',
                    'missing_fields': missing_fields
                })
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(config)
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            error_msg = 'Authentication secrets not found. Please configure Auth0 and OAuth credentials in AWS Secrets Manager.'
        else:
            error_msg = f'AWS error: {error_code}'
        
        print(f"ClientError: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': error_msg})
        }
        
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }
EOF
    filename = "auth_config.py"
  }
}

data "archive_file" "clock_in_out_zip" {
  type        = "zip"
  output_path = "clock_in_out.zip"
  
  source {
    content  = file("../Backend/clock_in_out.py")
    filename = "clock_in_out.py"
  }
  
  source {
    content  = file("../Backend/auth_utils.py")
    filename = "auth_utils.py"
  }
}

data "archive_file" "get_timesheets_zip" {
  type        = "zip"
  output_path = "get_timesheets.zip"
  
  source {
    content  = file("../Backend/get_timesheets.py")
    filename = "get_timesheets.py"
  }
  
  source {
    content  = file("../Backend/auth_utils.py")
    filename = "auth_utils.py"
  }
}

data "archive_file" "update_timesheet_zip" {
  type        = "zip"
  output_path = "update_timesheet.zip"
  
  source {
    content  = file("../Backend/update_timesheet.py")
    filename = "update_timesheet.py"
  }
  
  source {
    content  = file("../Backend/auth_utils.py")
    filename = "auth_utils.py"
  }
}

data "archive_file" "export_timesheet_zip" {
  type        = "zip"
  output_path = "export_timesheet.zip"
  
  source {
    content  = file("../Backend/export_timesheet.py")
    filename = "export_timesheet.py"
  }
  
  source {
    content  = file("../Backend/auth_utils.py")
    filename = "auth_utils.py"
  }
}

data "archive_file" "clock_status_zip" {
  type        = "zip"
  output_path = "clock_status.zip"
  
  source {
    content  = file("../Backend/clock_status.py")
    filename = "clock_status.py"
  }
  
  source {
    content  = file("../Backend/auth_utils.py")
    filename = "auth_utils.py"
  }
}

# IAM roles for Lambda functions
resource "aws_iam_role" "auth_config_lambda_role" {
  name = "${var.app_name}-auth-config-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

resource "aws_iam_role" "timesheet_lambda_role" {
  name = "${var.app_name}-timesheet-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

# IAM role policy attachments
resource "aws_iam_role_policy_attachment" "auth_config_lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.auth_config_lambda_role.name
}

resource "aws_iam_role_policy_attachment" "auth_config_lambda_secrets" {
  policy_arn = aws_iam_policy.secrets_access.arn
  role       = aws_iam_role.auth_config_lambda_role.name
}

resource "aws_iam_role_policy_attachment" "timesheet_lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.timesheet_lambda_role.name
}

resource "aws_iam_role_policy_attachment" "timesheet_lambda_dynamodb" {
  policy_arn = aws_iam_policy.dynamodb_access.arn
  role       = aws_iam_role.timesheet_lambda_role.name
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "auth_config_lambda_logs" {
  name              = "/aws/lambda/${var.app_name}-auth-config"
  retention_in_days = 14
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "clock_in_out_logs" {
  name              = "/aws/lambda/${var.app_name}-clock-in-out"
  retention_in_days = 14
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "get_timesheets_logs" {
  name              = "/aws/lambda/${var.app_name}-get-timesheets"
  retention_in_days = 14
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "update_timesheet_logs" {
  name              = "/aws/lambda/${var.app_name}-update-timesheet"
  retention_in_days = 14
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "export_timesheet_logs" {
  name              = "/aws/lambda/${var.app_name}-export-timesheet"
  retention_in_days = 14
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "clock_status_logs" {
  name              = "/aws/lambda/${var.app_name}-clock-status"
  retention_in_days = 14
  tags              = var.common_tags
}

# Lambda functions
resource "aws_lambda_function" "auth_config" {
  filename         = data.archive_file.auth_config_zip.output_path
  function_name    = "${var.app_name}-auth-config"
  role            = aws_iam_role.auth_config_lambda_role.arn
  handler         = "auth_config.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  source_code_hash = data.archive_file.auth_config_zip.output_base64sha256

  environment {
    variables = {
      ALLOWED_ORIGINS = "https://${var.app_domain},https://www.${var.app_domain}"
    }
  }

  tags = var.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.auth_config_lambda_basic,
    aws_iam_role_policy_attachment.auth_config_lambda_secrets,
    aws_cloudwatch_log_group.auth_config_lambda_logs
  ]
}

resource "aws_lambda_function" "clock_in_out" {
  filename         = data.archive_file.clock_in_out_zip.output_path
  function_name    = "${var.app_name}-clock-in-out"
  role            = aws_iam_role.timesheet_lambda_role.arn
  handler         = "clock_in_out.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  source_code_hash = data.archive_file.clock_in_out_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.timesheet_table.name
    }
  }

  tags = var.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.timesheet_lambda_basic,
    aws_iam_role_policy_attachment.timesheet_lambda_dynamodb,
    aws_cloudwatch_log_group.clock_in_out_logs
  ]
}

resource "aws_lambda_function" "get_timesheets" {
  filename         = data.archive_file.get_timesheets_zip.output_path
  function_name    = "${var.app_name}-get-timesheets"
  role            = aws_iam_role.timesheet_lambda_role.arn
  handler         = "get_timesheets.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  source_code_hash = data.archive_file.get_timesheets_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.timesheet_table.name
    }
  }

  tags = var.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.timesheet_lambda_basic,
    aws_iam_role_policy_attachment.timesheet_lambda_dynamodb,
    aws_cloudwatch_log_group.get_timesheets_logs
  ]
}

resource "aws_lambda_function" "update_timesheet" {
  filename         = data.archive_file.update_timesheet_zip.output_path
  function_name    = "${var.app_name}-update-timesheet"
  role            = aws_iam_role.timesheet_lambda_role.arn
  handler         = "update_timesheet.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  source_code_hash = data.archive_file.update_timesheet_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.timesheet_table.name
    }
  }

  tags = var.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.timesheet_lambda_basic,
    aws_iam_role_policy_attachment.timesheet_lambda_dynamodb,
    aws_cloudwatch_log_group.update_timesheet_logs
  ]
}

resource "aws_lambda_function" "export_timesheet" {
  filename         = data.archive_file.export_timesheet_zip.output_path
  function_name    = "${var.app_name}-export-timesheet"
  role            = aws_iam_role.timesheet_lambda_role.arn
  handler         = "export_timesheet.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  source_code_hash = data.archive_file.export_timesheet_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.timesheet_table.name
    }
  }

  tags = var.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.timesheet_lambda_basic,
    aws_iam_role_policy_attachment.timesheet_lambda_dynamodb,
    aws_cloudwatch_log_group.export_timesheet_logs
  ]
}

resource "aws_lambda_function" "clock_status" {
  filename         = data.archive_file.clock_status_zip.output_path
  function_name    = "${var.app_name}-clock-status"
  role            = aws_iam_role.timesheet_lambda_role.arn
  handler         = "clock_status.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  source_code_hash = data.archive_file.clock_status_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.timesheet_table.name
    }
  }

  tags = var.common_tags

  depends_on = [
    aws_iam_role_policy_attachment.timesheet_lambda_basic,
    aws_iam_role_policy_attachment.timesheet_lambda_dynamodb,
    aws_cloudwatch_log_group.clock_status_logs
  ]
}