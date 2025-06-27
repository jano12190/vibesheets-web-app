# Route53 and ACM Certificate Configuration

# ACM Certificate for SSL/TLS (must be in us-east-1 for CloudFront)
resource "aws_acm_certificate" "app_cert" {
  provider                  = aws
  domain_name               = var.app_domain
  subject_alternative_names = ["www.${var.app_domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = var.common_tags
}

# ACM Certificate for API Gateway
resource "aws_acm_certificate" "api_cert" {
  provider                  = aws
  domain_name               = "api.${var.app_domain}"
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = var.common_tags
}

# Route53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.app_domain

  tags = var.common_tags
}

# Route53 records for certificate validation
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app_cert.domain_validation_options : dvo.domain_name => {
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

# Route53 records for API certificate validation
resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api_cert.domain_validation_options : dvo.domain_name => {
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

# Certificate validations
resource "aws_acm_certificate_validation" "app_cert_validation" {
  certificate_arn         = aws_acm_certificate.app_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
  
  timeouts {
    create = "5m"
  }
}

resource "aws_acm_certificate_validation" "api_cert_validation" {
  certificate_arn         = aws_acm_certificate.api_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
  
  timeouts {
    create = "5m"
  }
}

# Route53 records for main domain
resource "aws_route53_record" "root_domain" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.app_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.app_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.app_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_domain" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.app_domain}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.app_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.app_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

# API Gateway custom domain
resource "aws_api_gateway_domain_name" "auth_api_domain" {
  domain_name              = "api.${var.app_domain}"
  certificate_arn          = aws_acm_certificate_validation.api_cert_validation.certificate_arn
  security_policy          = "TLS_1_2"

  tags = var.common_tags
}

resource "aws_route53_record" "api_domain" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.app_domain}"
  type    = "A"

  alias {
    name                   = aws_api_gateway_domain_name.auth_api_domain.cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.auth_api_domain.cloudfront_zone_id
    evaluate_target_health = false
  }
}