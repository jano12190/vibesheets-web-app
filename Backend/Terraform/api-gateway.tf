# Clean API Gateway Configuration for Node.js Lambda Functions

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
      # Node.js Lambda function references
      aws_api_gateway_resource.auth_nodejs.id,
      aws_api_gateway_method.auth_get_nodejs.id,
      aws_api_gateway_integration.auth_get_nodejs.id,
      aws_api_gateway_resource.clock_nodejs.id,
      aws_api_gateway_method.clock_post_nodejs.id,
      aws_api_gateway_integration.clock_post_nodejs.id,
      aws_api_gateway_resource.status_nodejs.id,
      aws_api_gateway_method.status_get_nodejs.id,
      aws_api_gateway_integration.status_get_nodejs.id,
      aws_api_gateway_resource.timesheets_nodejs.id,
      aws_api_gateway_method.timesheets_get_nodejs.id,
      aws_api_gateway_method.timesheets_put_nodejs.id,
      aws_api_gateway_integration.timesheets_get_nodejs.id,
      aws_api_gateway_integration.timesheets_put_nodejs.id,
      aws_api_gateway_resource.export_nodejs.id,
      aws_api_gateway_method.export_post_nodejs.id,
      aws_api_gateway_integration.export_post_nodejs.id,
      aws_api_gateway_resource.projects_nodejs.id,
      aws_api_gateway_method.projects_get_nodejs.id,
      aws_api_gateway_method.projects_post_nodejs.id,
      aws_api_gateway_integration.projects_get_nodejs.id,
      aws_api_gateway_integration.projects_post_nodejs.id,
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
  zone_id         = data.aws_route53_zone.domain.zone_id
}

resource "aws_acm_certificate_validation" "api_ssl_certificate" {
  certificate_arn         = aws_acm_certificate.api_ssl_certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.api_ssl_certificate_validation : record.fqdn]
}

resource "aws_api_gateway_domain_name" "api" {
  domain_name              = "api.${var.domain_name}"
  certificate_arn          = aws_acm_certificate_validation.api_ssl_certificate.certificate_arn
  security_policy          = "TLS_1_2"
}

resource "aws_route53_record" "api" {
  name    = aws_api_gateway_domain_name.api.domain_name
  type    = "A"
  zone_id = data.aws_route53_zone.domain.zone_id

  alias {
    evaluate_target_health = false
    name                   = aws_api_gateway_domain_name.api.cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.api.cloudfront_zone_id
  }
}

resource "aws_api_gateway_base_path_mapping" "api" {
  api_id      = aws_api_gateway_rest_api.api.id
  stage_name  = aws_api_gateway_stage.api.stage_name
  domain_name = aws_api_gateway_domain_name.api.domain_name
}