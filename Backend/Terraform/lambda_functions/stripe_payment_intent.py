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
    """Create a Stripe payment intent for subscription or invoice payment"""
    
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
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Request body is required'})
            }
        
        # Get Stripe configuration
        stripe_config = get_stripe_config()
        stripe.api_key = stripe_config['stripe_secret_key']
        
        # Extract payment details
        amount = body.get('amount')  # Amount in cents
        currency = body.get('currency', 'usd')
        payment_type = body.get('type', 'subscription')  # 'subscription' or 'invoice'
        customer_email = user_data.get('email', body.get('customer_email'))
        
        if not amount or amount <= 0:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Valid amount is required'})
            }
        
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
        
        # Create payment intent
        try:
            intent_data = {
                'amount': int(amount),
                'currency': currency,
                'customer': customer.id,
                'metadata': {
                    'user_id': user_data.get('sub', ''),
                    'payment_type': payment_type,
                    'customer_email': customer_email
                }
            }
            
            # Add additional metadata based on payment type
            if payment_type == 'invoice':
                intent_data['metadata']['invoice_id'] = body.get('invoice_id', '')
                intent_data['metadata']['project_id'] = body.get('project_id', '')
            elif payment_type == 'subscription':
                intent_data['metadata']['plan'] = body.get('plan', 'pro')
            
            payment_intent = stripe.PaymentIntent.create(**intent_data)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'client_secret': payment_intent.client_secret,
                    'payment_intent_id': payment_intent.id,
                    'customer_id': customer.id
                })
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Error creating payment intent: {str(e)}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': 'Failed to create payment intent'})
            }
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }