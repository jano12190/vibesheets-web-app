import json
import os
import boto3
import stripe
import logging
from auth_utils import verify_jwt_token

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
    """Create a Stripe Setup Intent for collecting payment method information"""
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
        
        # Verify JWT token
        auth_header = event.get('headers', {}).get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Missing or invalid authorization header'})
            }
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        if not user_data:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Invalid token'})
            }
        
        # Parse request body
        if event.get('body'):
            try:
                body = json.loads(event['body'])
            except json.JSONDecodeError:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Invalid JSON in request body'})
                }
        else:
            body = {}
        
        # Get Stripe configuration
        stripe_config = get_stripe_config()
        stripe.api_key = stripe_config['stripe_secret_key']
        
        customer_email = user_data.get('email', body.get('customer_email'))
        
        # Create or get Stripe customer
        customer = None
        try:
            # Try to find existing customer by email
            customers = stripe.Customer.list(email=customer_email, limit=1)
            if customers.data:
                customer = customers.data[0]
            else:
                # Create new customer
                customer = stripe.Customer.create(
                    email=customer_email,
                    metadata={
                        'user_id': user_data.get('sub', ''),
                        'source': 'vibesheets'
                    }
                )
        except stripe.error.StripeError as e:
            logger.error(f"Error creating/finding Stripe customer: {str(e)}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': 'Failed to create customer'})
            }
        
        # Create Setup Intent
        try:
            setup_intent = stripe.SetupIntent.create(
                customer=customer.id,
                payment_method_types=['card'],
                usage='off_session',  # For future payments
                metadata={
                    'user_id': user_data.get('sub', ''),
                    'customer_email': customer_email
                }
            )
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'client_secret': setup_intent.client_secret,
                    'setup_intent_id': setup_intent.id,
                    'customer_id': customer.id
                })
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Error creating setup intent: {str(e)}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': 'Failed to create setup intent'})
            }
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }