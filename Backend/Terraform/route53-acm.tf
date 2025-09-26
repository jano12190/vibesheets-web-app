# Use existing hosted zone for the domain
data "aws_route53_zone" "domain" {
  count        = var.existing_route53_zone_id == "" ? 1 : 0
  name         = var.domain_name
  private_zone = false
}

# Use existing hosted zone by ID if provided
data "aws_route53_zone" "existing" {
  count   = var.existing_route53_zone_id != "" ? 1 : 0
  zone_id = var.existing_route53_zone_id
}

# Local value to determine which zone to use
locals {
  zone_id = var.existing_route53_zone_id != "" ? data.aws_route53_zone.existing[0].zone_id : data.aws_route53_zone.domain[0].zone_id
}

# Use existing ACM certificate if provided
data "aws_acm_certificate" "existing" {
  count  = var.existing_acm_certificate_arn != "" ? 1 : 0
  arn    = var.existing_acm_certificate_arn
}

# Create new SSL Certificate if not using existing
resource "aws_acm_certificate" "ssl_certificate" {
  count                     = var.existing_acm_certificate_arn == "" ? 1 : 0
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Local value to determine which certificate to use
locals {
  certificate_arn = var.existing_acm_certificate_arn != "" ? var.existing_acm_certificate_arn : aws_acm_certificate.ssl_certificate[0].arn
}

# Certificate validation records (only if creating new certificate)
resource "aws_route53_record" "ssl_certificate_validation" {
  for_each = var.existing_acm_certificate_arn == "" ? {
    for dvo in aws_acm_certificate.ssl_certificate[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.zone_id
}

# Certificate validation (only if creating new certificate)
resource "aws_acm_certificate_validation" "ssl_certificate" {
  count                   = var.existing_acm_certificate_arn == "" ? 1 : 0
  certificate_arn         = aws_acm_certificate.ssl_certificate[0].arn
  validation_record_fqdns = [for record in aws_route53_record.ssl_certificate_validation : record.fqdn]
  
  timeouts {
    create = "10m"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Route53 records for CloudFront distribution
resource "aws_route53_record" "root" {
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = local.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# API subdomain route is defined in api-gateway.tf - removed duplicate