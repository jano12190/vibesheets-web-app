# API Gateway for Node.js Lambda Functions

# /auth resource
resource "aws_api_gateway_resource" "auth_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_method" "auth_get_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.auth_nodejs.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_get_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth_nodejs.id
  http_method = aws_api_gateway_method.auth_get_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.auth_config_nodejs.invoke_arn
}

# Lambda permission for auth
resource "aws_lambda_permission" "auth_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_config_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# /clock resource  
resource "aws_api_gateway_resource" "clock_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "clock"
}

resource "aws_api_gateway_method" "clock_post_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.clock_nodejs.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "clock_post_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.clock_nodejs.id
  http_method = aws_api_gateway_method.clock_post_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.clock_in_out_nodejs.invoke_arn
}

resource "aws_lambda_permission" "clock_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clock_in_out_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# /status resource
resource "aws_api_gateway_resource" "status_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "status"
}

resource "aws_api_gateway_method" "status_get_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.status_nodejs.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "status_get_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status_nodejs.id
  http_method = aws_api_gateway_method.status_get_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.clock_status_nodejs.invoke_arn
}

resource "aws_lambda_permission" "status_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clock_status_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# /timesheets resource
resource "aws_api_gateway_resource" "timesheets_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "timesheets"
}

resource "aws_api_gateway_method" "timesheets_get_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.timesheets_nodejs.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "timesheets_put_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.timesheets_nodejs.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timesheets_get_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets_nodejs.id
  http_method = aws_api_gateway_method.timesheets_get_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.get_timesheets_nodejs.invoke_arn
}

resource "aws_api_gateway_integration" "timesheets_put_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets_nodejs.id
  http_method = aws_api_gateway_method.timesheets_put_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.update_timesheet_nodejs.invoke_arn
}

resource "aws_lambda_permission" "get_timesheets_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_timesheets_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "update_timesheet_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_timesheet_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# /export resource
resource "aws_api_gateway_resource" "export_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "export"
}

resource "aws_api_gateway_method" "export_post_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.export_nodejs.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "export_post_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.export_nodejs.id
  http_method = aws_api_gateway_method.export_post_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.export_timesheet_nodejs.invoke_arn
}

resource "aws_lambda_permission" "export_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.export_timesheet_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# /projects resource
resource "aws_api_gateway_resource" "projects_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "projects"
}

resource "aws_api_gateway_method" "projects_get_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.projects_nodejs.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "projects_post_nodejs" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.projects_nodejs.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "projects_get_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.projects_nodejs.id
  http_method = aws_api_gateway_method.projects_get_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.get_projects_nodejs.invoke_arn
}

resource "aws_api_gateway_integration" "projects_post_nodejs" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.projects_nodejs.id
  http_method = aws_api_gateway_method.projects_post_nodejs.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.create_project_nodejs.invoke_arn
}

resource "aws_lambda_permission" "get_projects_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_projects_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "create_project_nodejs" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_project_nodejs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# CORS for all resources
resource "aws_api_gateway_method" "cors_auth" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.auth_nodejs.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_auth" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth_nodejs.id
  http_method = aws_api_gateway_method.cors_auth.http_method
  type        = "MOCK"
  
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_auth" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth_nodejs.id
  http_method = aws_api_gateway_method.cors_auth.http_method
  status_code = "200"
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "cors_auth" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth_nodejs.id
  http_method = aws_api_gateway_method.cors_auth.http_method
  status_code = aws_api_gateway_method_response.cors_auth.status_code
  
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}