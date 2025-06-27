# API Gateway Configuration

# Auth API Gateway
resource "aws_api_gateway_rest_api" "auth_api" {
  name        = "${var.app_name}-auth-api"
  description = "API for ${var.app_name} authentication configuration"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.common_tags
}

# Auth API Gateway resource
resource "aws_api_gateway_resource" "auth_config_resource" {
  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  parent_id   = aws_api_gateway_rest_api.auth_api.root_resource_id
  path_part   = "config"
}

# Auth API Gateway methods
resource "aws_api_gateway_method" "auth_config_method" {
  rest_api_id   = aws_api_gateway_rest_api.auth_api.id
  resource_id   = aws_api_gateway_resource.auth_config_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "auth_config_options" {
  rest_api_id   = aws_api_gateway_rest_api.auth_api.id
  resource_id   = aws_api_gateway_resource.auth_config_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Auth API Gateway integrations
resource "aws_api_gateway_integration" "auth_config_integration" {
  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  resource_id = aws_api_gateway_resource.auth_config_resource.id
  http_method = aws_api_gateway_method.auth_config_method.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.auth_config.invoke_arn
}

resource "aws_api_gateway_integration" "auth_config_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.auth_api.id
  resource_id = aws_api_gateway_resource.auth_config_resource.id
  http_method = aws_api_gateway_method.auth_config_options.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.auth_config.invoke_arn
}

# Lambda permission for auth API Gateway
resource "aws_lambda_permission" "auth_config_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_config.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.auth_api.execution_arn}/*/*"
}

# Auth API Gateway deployment
resource "aws_api_gateway_deployment" "auth_api_deployment" {
  depends_on = [
    aws_api_gateway_integration.auth_config_integration,
    aws_api_gateway_integration.auth_config_options_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.auth_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.auth_config_resource.id,
      aws_api_gateway_method.auth_config_method.id,
      aws_api_gateway_method.auth_config_options.id,
      aws_api_gateway_integration.auth_config_integration.id,
      aws_api_gateway_integration.auth_config_options_integration.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Auth API Gateway stage
resource "aws_api_gateway_stage" "auth_api_stage" {
  deployment_id = aws_api_gateway_deployment.auth_api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.auth_api.id
  stage_name    = "prod"

  tags = var.common_tags
}

# Auth API Gateway base path mapping
resource "aws_api_gateway_base_path_mapping" "auth_api_mapping" {
  api_id      = aws_api_gateway_rest_api.auth_api.id
  stage_name  = aws_api_gateway_stage.auth_api_stage.stage_name
  domain_name = aws_api_gateway_domain_name.auth_api_domain.domain_name
  base_path   = "config"
}

# ===== TIMESHEET API GATEWAY =====

# Timesheet API Gateway
resource "aws_api_gateway_rest_api" "timesheet_api" {
  name        = "${var.app_name}-timesheet-api"
  description = "API for ${var.app_name} timesheet operations"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.common_tags
}

# Timesheet API Gateway resources
resource "aws_api_gateway_resource" "clock_in_resource" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  parent_id   = aws_api_gateway_rest_api.timesheet_api.root_resource_id
  path_part   = "clock-in"
}

resource "aws_api_gateway_resource" "clock_out_resource" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  parent_id   = aws_api_gateway_rest_api.timesheet_api.root_resource_id
  path_part   = "clock-out"
}

resource "aws_api_gateway_resource" "clock_status_resource" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  parent_id   = aws_api_gateway_rest_api.timesheet_api.root_resource_id
  path_part   = "clock-status"
}

resource "aws_api_gateway_resource" "entries_resource" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  parent_id   = aws_api_gateway_rest_api.timesheet_api.root_resource_id
  path_part   = "entries"
}

resource "aws_api_gateway_resource" "entry_by_id_resource" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  parent_id   = aws_api_gateway_resource.entries_resource.id
  path_part   = "{entryId}"
}

resource "aws_api_gateway_resource" "export_resource" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  parent_id   = aws_api_gateway_rest_api.timesheet_api.root_resource_id
  path_part   = "export"
}

resource "aws_api_gateway_resource" "hours_resource" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  parent_id   = aws_api_gateway_rest_api.timesheet_api.root_resource_id
  path_part   = "hours"
}

# Timesheet API Gateway methods
resource "aws_api_gateway_method" "clock_in_post" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.clock_in_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "clock_out_post" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.clock_out_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "clock_status_get" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.clock_status_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "entries_get" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.entries_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "entry_update" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.entry_by_id_resource.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "entry_delete" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.entry_by_id_resource.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "export_get" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.export_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "hours_get" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.hours_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

# CORS OPTIONS methods
resource "aws_api_gateway_method" "clock_in_options" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.clock_in_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "clock_out_options" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.clock_out_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "clock_status_options" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.clock_status_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "entries_options" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.entries_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "entry_by_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.entry_by_id_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "export_options" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.export_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "hours_options" {
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  resource_id   = aws_api_gateway_resource.hours_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Lambda integrations
resource "aws_api_gateway_integration" "clock_in_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_in_resource.id
  http_method = aws_api_gateway_method.clock_in_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.clock_in_out.invoke_arn
}

resource "aws_api_gateway_integration" "clock_out_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_out_resource.id
  http_method = aws_api_gateway_method.clock_out_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.clock_in_out.invoke_arn
}

resource "aws_api_gateway_integration" "clock_status_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_status_resource.id
  http_method = aws_api_gateway_method.clock_status_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.clock_status.invoke_arn
}

resource "aws_api_gateway_integration" "entries_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.entries_resource.id
  http_method = aws_api_gateway_method.entries_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.get_timesheets.invoke_arn
}

resource "aws_api_gateway_integration" "entry_update_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.entry_by_id_resource.id
  http_method = aws_api_gateway_method.entry_update.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.update_timesheet.invoke_arn
}

resource "aws_api_gateway_integration" "entry_delete_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.entry_by_id_resource.id
  http_method = aws_api_gateway_method.entry_delete.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.update_timesheet.invoke_arn
}

resource "aws_api_gateway_integration" "export_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.export_resource.id
  http_method = aws_api_gateway_method.export_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.export_timesheet.invoke_arn
}

resource "aws_api_gateway_integration" "hours_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.hours_resource.id
  http_method = aws_api_gateway_method.hours_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.get_timesheets.invoke_arn
}

# CORS integrations (mock responses) - simplified for main endpoints
resource "aws_api_gateway_integration" "clock_in_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_in_resource.id
  http_method = aws_api_gateway_method.clock_in_options.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

# Add CORS integration for other endpoints
resource "aws_api_gateway_integration" "entries_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.entries_resource.id
  http_method = aws_api_gateway_method.entries_options.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "clock_out_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_out_resource.id
  http_method = aws_api_gateway_method.clock_out_options.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "clock_status_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_status_resource.id
  http_method = aws_api_gateway_method.clock_status_options.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "entry_by_id_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.entry_by_id_resource.id
  http_method = aws_api_gateway_method.entry_by_id_options.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "export_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.export_resource.id
  http_method = aws_api_gateway_method.export_options.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "hours_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.hours_resource.id
  http_method = aws_api_gateway_method.hours_options.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "entries_options_response" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.entries_resource.id
  http_method = aws_api_gateway_method.entries_options.http_method
  status_code = "200"
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "entries_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.entries_resource.id
  http_method = aws_api_gateway_method.entries_options.http_method
  status_code = aws_api_gateway_method_response.entries_options_response.status_code
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method_response" "clock_in_options_response" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_in_resource.id
  http_method = aws_api_gateway_method.clock_in_options.http_method
  status_code = "200"
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "clock_in_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id
  resource_id = aws_api_gateway_resource.clock_in_resource.id
  http_method = aws_api_gateway_method.clock_in_options.http_method
  status_code = aws_api_gateway_method_response.clock_in_options_response.status_code
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda permissions for timesheet API Gateway
resource "aws_lambda_permission" "clock_in_out_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clock_in_out.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.timesheet_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_timesheets_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_timesheets.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.timesheet_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "update_timesheet_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_timesheet.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.timesheet_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "export_timesheet_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.export_timesheet.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.timesheet_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "clock_status_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clock_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.timesheet_api.execution_arn}/*/*"
}

# Timesheet API Gateway deployment
resource "aws_api_gateway_deployment" "timesheet_api_deployment" {
  depends_on = [
    aws_api_gateway_integration.clock_in_integration,
    aws_api_gateway_integration.clock_out_integration,
    aws_api_gateway_integration.clock_status_integration,
    aws_api_gateway_integration.entries_integration,
    aws_api_gateway_integration.entry_update_integration,
    aws_api_gateway_integration.entry_delete_integration,
    aws_api_gateway_integration.export_integration,
    aws_api_gateway_integration.hours_integration,
    aws_api_gateway_integration.clock_in_options_integration,
    aws_api_gateway_integration.clock_out_options_integration,
    aws_api_gateway_integration.clock_status_options_integration,
    aws_api_gateway_integration.entries_options_integration,
    aws_api_gateway_integration.entry_by_id_options_integration,
    aws_api_gateway_integration.export_options_integration,
    aws_api_gateway_integration.hours_options_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.timesheet_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.clock_in_resource.id,
      aws_api_gateway_resource.clock_out_resource.id,
      aws_api_gateway_resource.clock_status_resource.id,
      aws_api_gateway_resource.entries_resource.id,
      aws_api_gateway_resource.entry_by_id_resource.id,
      aws_api_gateway_resource.export_resource.id,
      aws_api_gateway_resource.hours_resource.id,
      aws_api_gateway_method.clock_in_post.id,
      aws_api_gateway_method.clock_out_post.id,
      aws_api_gateway_method.clock_status_get.id,
      aws_api_gateway_method.entries_get.id,
      aws_api_gateway_method.entry_update.id,
      aws_api_gateway_method.entry_delete.id,
      aws_api_gateway_method.export_get.id,
      aws_api_gateway_method.hours_get.id
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Timesheet API Gateway stage
resource "aws_api_gateway_stage" "timesheet_api_stage" {
  deployment_id = aws_api_gateway_deployment.timesheet_api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.timesheet_api.id
  stage_name    = "prod"

  tags = var.common_tags
}

# Timesheet API Gateway base path mapping
resource "aws_api_gateway_base_path_mapping" "timesheet_api_mapping" {
  api_id      = aws_api_gateway_rest_api.timesheet_api.id
  stage_name  = aws_api_gateway_stage.timesheet_api_stage.stage_name
  domain_name = aws_api_gateway_domain_name.auth_api_domain.domain_name
  base_path   = "api"
}