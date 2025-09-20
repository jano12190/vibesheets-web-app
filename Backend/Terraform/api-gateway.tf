# API Gateway REST API
resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "VibeSheets Timesheet API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "api" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.auth.id,
      aws_api_gateway_method.auth_options.id,
      aws_api_gateway_method.auth_get.id,
      aws_api_gateway_integration.auth_get.id,
      aws_api_gateway_resource.clock.id,
      aws_api_gateway_method.clock_options.id,
      aws_api_gateway_method.clock_post.id,
      aws_api_gateway_integration.clock_post.id,
      aws_api_gateway_resource.status.id,
      aws_api_gateway_method.status_options.id,
      aws_api_gateway_method.status_get.id,
      aws_api_gateway_integration.status_get.id,
      aws_api_gateway_resource.timesheets.id,
      aws_api_gateway_method.timesheets_options.id,
      aws_api_gateway_method.timesheets_get.id,
      aws_api_gateway_method.timesheets_put.id,
      aws_api_gateway_method.timesheets_delete.id,
      aws_api_gateway_integration.timesheets_get.id,
      aws_api_gateway_integration.timesheets_put.id,
      aws_api_gateway_integration.timesheets_delete.id,
      aws_api_gateway_resource.export.id,
      aws_api_gateway_method.export_options.id,
      aws_api_gateway_method.export_post.id,
      aws_api_gateway_integration.export_post.id,
      aws_api_gateway_resource.stripe_config.id,
      aws_api_gateway_method.stripe_config_get.id,
      aws_api_gateway_integration.stripe_config_get.id,
      aws_api_gateway_resource.stripe_payment.id,
      aws_api_gateway_method.stripe_payment_options.id,
      aws_api_gateway_method.stripe_payment_post.id,
      aws_api_gateway_integration.stripe_payment_post.id,
      aws_api_gateway_resource.stripe_webhook.id,
      aws_api_gateway_method.stripe_webhook_post.id,
      aws_api_gateway_integration.stripe_webhook_post.id,
      aws_api_gateway_resource.stripe_setup.id,
      aws_api_gateway_method.stripe_setup_options.id,
      aws_api_gateway_method.stripe_setup_post.id,
      aws_api_gateway_integration.stripe_setup_post.id,
      aws_api_gateway_resource.projects.id,
      aws_api_gateway_method.projects_options.id,
      aws_api_gateway_method.projects_get.id,
      aws_api_gateway_method.projects_post.id,
      aws_api_gateway_integration.projects_get.id,
      aws_api_gateway_integration.projects_post.id,
      aws_api_gateway_resource.project_by_id.id,
      aws_api_gateway_method.project_by_id_options.id,
      aws_api_gateway_method.project_by_id_put.id,
      aws_api_gateway_method.project_by_id_delete.id,
      aws_api_gateway_integration.project_by_id_put.id,
      aws_api_gateway_integration.project_by_id_delete.id,
      # Force redeployment timestamp
      timestamp(),
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "api" {
  deployment_id = aws_api_gateway_deployment.api.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment
}

# Custom domain for API Gateway
resource "aws_acm_certificate" "api_ssl_certificate" {
  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_ssl_certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api_ssl_certificate.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "api_ssl_certificate" {
  certificate_arn         = aws_acm_certificate.api_ssl_certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.api_ssl_certificate_validation : record.fqdn]
  
  timeouts {
    create = "10m"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_domain_name" "api" {
  domain_name              = "api.${var.domain_name}"
  regional_certificate_arn = aws_acm_certificate.api_ssl_certificate.arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }
  
  # Note: This will be created with an unvalidated certificate initially
  # Once DNS nameservers are updated and certificate validates, run terraform apply again
}

resource "aws_api_gateway_base_path_mapping" "api" {
  api_id      = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.api.stage_name
  domain_name = aws_api_gateway_domain_name.api.domain_name
}

# CORS configuration
resource "aws_api_gateway_gateway_response" "cors" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  response_type = "DEFAULT_4XX"

  response_templates = {
    "application/json" = "{'message':$context.error.messageString}"
  }

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'*'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
  }
}

# Auth configuration endpoint
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_method" "auth_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "auth_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "auth_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_options.http_method
  status_code = aws_api_gateway_method_response.auth_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "auth_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_get" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.auth_config.invoke_arn
}

resource "aws_lambda_permission" "auth_config" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_config.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Clock in/out endpoint
resource "aws_api_gateway_resource" "clock" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "clock"
}

resource "aws_api_gateway_method" "clock_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.clock.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "clock_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.clock.id
  http_method = aws_api_gateway_method.clock_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "clock_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.clock.id
  http_method = aws_api_gateway_method.clock_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "clock_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.clock.id
  http_method = aws_api_gateway_method.clock_options.http_method
  status_code = aws_api_gateway_method_response.clock_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "clock_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.clock.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "clock_post" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.clock.id
  http_method = aws_api_gateway_method.clock_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.clock_in_out.invoke_arn
}

resource "aws_lambda_permission" "clock_in_out" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clock_in_out.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Clock status endpoint
resource "aws_api_gateway_resource" "status" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "status"
}

resource "aws_api_gateway_method" "status_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.status.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "status_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.status_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "status_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.status_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "status_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.status_options.http_method
  status_code = aws_api_gateway_method_response.status_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "status_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.status.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "status_get" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status.id
  http_method = aws_api_gateway_method.status_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.clock_status.invoke_arn
}

resource "aws_lambda_permission" "clock_status" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clock_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Timesheets endpoint
resource "aws_api_gateway_resource" "timesheets" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "timesheets"
}

resource "aws_api_gateway_method" "timesheets_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.timesheets.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timesheets_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets.id
  http_method = aws_api_gateway_method.timesheets_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "timesheets_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets.id
  http_method = aws_api_gateway_method.timesheets_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "timesheets_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets.id
  http_method = aws_api_gateway_method.timesheets_options.http_method
  status_code = aws_api_gateway_method_response.timesheets_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "timesheets_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.timesheets.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timesheets_get" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets.id
  http_method = aws_api_gateway_method.timesheets_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.get_timesheets.invoke_arn
}

resource "aws_lambda_permission" "get_timesheets" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_timesheets.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_api_gateway_method" "timesheets_put" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.timesheets.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timesheets_put" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets.id
  http_method = aws_api_gateway_method.timesheets_put.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.update_timesheet.invoke_arn
}

resource "aws_api_gateway_method" "timesheets_delete" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.timesheets.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "timesheets_delete" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.timesheets.id
  http_method = aws_api_gateway_method.timesheets_delete.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.update_timesheet.invoke_arn
}

resource "aws_lambda_permission" "update_timesheet" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_timesheet.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Export endpoint
resource "aws_api_gateway_resource" "export" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "export"
}

resource "aws_api_gateway_method" "export_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.export.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "export_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.export.id
  http_method = aws_api_gateway_method.export_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "export_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.export.id
  http_method = aws_api_gateway_method.export_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "export_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.export.id
  http_method = aws_api_gateway_method.export_options.http_method
  status_code = aws_api_gateway_method_response.export_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "export_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.export.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "export_post" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.export.id
  http_method = aws_api_gateway_method.export_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.export_timesheet.invoke_arn
}

resource "aws_lambda_permission" "export_timesheet" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.export_timesheet.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Stripe configuration endpoint
resource "aws_api_gateway_resource" "stripe_config" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "stripe-config"
}

resource "aws_api_gateway_method" "stripe_config_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.stripe_config.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_config_get" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_config.id
  http_method = aws_api_gateway_method.stripe_config_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.stripe_config.invoke_arn
}

resource "aws_lambda_permission" "stripe_config" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stripe_config.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Stripe payment intent endpoint
resource "aws_api_gateway_resource" "stripe_payment" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "stripe-payment"
}

resource "aws_api_gateway_method" "stripe_payment_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.stripe_payment.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_payment_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_payment.id
  http_method = aws_api_gateway_method.stripe_payment_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "stripe_payment_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_payment.id
  http_method = aws_api_gateway_method.stripe_payment_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_payment_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_payment.id
  http_method = aws_api_gateway_method.stripe_payment_options.http_method
  status_code = aws_api_gateway_method_response.stripe_payment_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "stripe_payment_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.stripe_payment.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_payment_post" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_payment.id
  http_method = aws_api_gateway_method.stripe_payment_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.stripe_payment_intent.invoke_arn
}

resource "aws_lambda_permission" "stripe_payment_intent" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stripe_payment_intent.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Stripe webhook endpoint
resource "aws_api_gateway_resource" "stripe_webhook" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "stripe-webhook"
}

resource "aws_api_gateway_method" "stripe_webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.stripe_webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_webhook_post" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_webhook.id
  http_method = aws_api_gateway_method.stripe_webhook_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.stripe_webhook.invoke_arn
}

resource "aws_lambda_permission" "stripe_webhook" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stripe_webhook.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Stripe setup intent endpoint
resource "aws_api_gateway_resource" "stripe_setup" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "stripe-setup"
}

resource "aws_api_gateway_method" "stripe_setup_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.stripe_setup.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_setup_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_setup.id
  http_method = aws_api_gateway_method.stripe_setup_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "stripe_setup_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_setup.id
  http_method = aws_api_gateway_method.stripe_setup_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_setup_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_setup.id
  http_method = aws_api_gateway_method.stripe_setup_options.http_method
  status_code = aws_api_gateway_method_response.stripe_setup_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_method" "stripe_setup_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.stripe_setup.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_setup_post" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.stripe_setup.id
  http_method = aws_api_gateway_method.stripe_setup_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.stripe_setup_intent.invoke_arn
}

resource "aws_lambda_permission" "stripe_setup_intent" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stripe_setup_intent.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Projects endpoint
resource "aws_api_gateway_resource" "projects" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "projects"
}

resource "aws_api_gateway_method" "projects_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.projects.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "projects_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.projects_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "projects_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.projects_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "projects_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.projects_options.http_method
  status_code = aws_api_gateway_method_response.projects_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# GET /projects
resource "aws_api_gateway_method" "projects_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.projects.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "projects_get" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.projects_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.get_projects.invoke_arn
}

resource "aws_lambda_permission" "get_projects" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_projects.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# POST /projects
resource "aws_api_gateway_method" "projects_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.projects.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "projects_post" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.projects_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.create_project.invoke_arn
}

resource "aws_lambda_permission" "create_project" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_project.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Project by ID resource
resource "aws_api_gateway_resource" "project_by_id" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.projects.id
  path_part   = "{projectId}"
}

resource "aws_api_gateway_method" "project_by_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.project_by_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "project_by_id_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.project_by_id.id
  http_method = aws_api_gateway_method.project_by_id_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{'statusCode': 200}"
  }
}

resource "aws_api_gateway_method_response" "project_by_id_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.project_by_id.id
  http_method = aws_api_gateway_method.project_by_id_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "project_by_id_options" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.project_by_id.id
  http_method = aws_api_gateway_method.project_by_id_options.http_method
  status_code = aws_api_gateway_method_response.project_by_id_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# PUT /projects/{projectId}
resource "aws_api_gateway_method" "project_by_id_put" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.project_by_id.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "project_by_id_put" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.project_by_id.id
  http_method = aws_api_gateway_method.project_by_id_put.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.update_project.invoke_arn
}

resource "aws_lambda_permission" "update_project" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_project.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# DELETE /projects/{projectId}
resource "aws_api_gateway_method" "project_by_id_delete" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.project_by_id.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "project_by_id_delete" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.project_by_id.id
  http_method = aws_api_gateway_method.project_by_id_delete.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.delete_project.invoke_arn
}

resource "aws_lambda_permission" "delete_project" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.delete_project.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}