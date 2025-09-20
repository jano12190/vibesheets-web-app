import json
import os
import boto3
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize clients
secrets_client = boto3.client('secretsmanager')

def get_stripe_config():
    """Retrieve Stripe configuration from AWS Secrets Manager"""
    try:
        secret_name = os.environ.get('STRIPE_SECRET_NAME', 'vibesheets-stripe-config-prod')
        response = secrets_client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except Exception as e:
        logger.error(f"Error retrieving Stripe config: {str(e)}")
        raise

def lambda_handler(event, context):
    """Return public Stripe configuration for frontend"""
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    }
    
    try:
        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': ''
            }
        
        # Get Stripe configuration
        stripe_config = get_stripe_config()
        
        # Return only public configuration
        public_config = {
            'stripe_public_key': stripe_config.get('stripe_public_key', ''),
            'environment': os.environ.get('ENVIRONMENT', 'prod')
        }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(public_config)
        }
    
    except Exception as e:
        logger.error(f"Error getting Stripe config: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to retrieve configuration'})
        }