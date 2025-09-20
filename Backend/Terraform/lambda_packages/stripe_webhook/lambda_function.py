import json
import os
import boto3
import stripe
import logging
from datetime import datetime, timedelta

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize clients
secrets_client = boto3.client('secretsmanager')
dynamodb = boto3.resource('dynamodb')

def get_stripe_config():
    """Retrieve Stripe configuration from AWS Secrets Manager"""
    try:
        secret_name = os.environ.get('STRIPE_SECRET_NAME', 'vibesheets-stripe-config-prod')
        response = secrets_client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except Exception as e:
        logger.error(f"Error retrieving Stripe config: {str(e)}")
        raise

def update_user_subscription(user_id, plan, status, payment_intent_id=None):
    """Update user subscription in DynamoDB"""
    try:
        user_settings_table = dynamodb.Table(os.environ.get('USER_SETTINGS_TABLE', 'user_settings'))
        
        update_expression = 'SET subscription_plan = :plan, subscription_status = :status, last_updated = :timestamp'
        expression_values = {
            ':plan': plan,
            ':status': status,
            ':timestamp': datetime.utcnow().isoformat()
        }
        
        if payment_intent_id:
            update_expression += ', last_payment_intent = :payment_intent'
            expression_values[':payment_intent'] = payment_intent_id
        
        if status == 'active':
            # Set subscription end date (30 days from now for monthly plans)
            end_date = datetime.utcnow() + timedelta(days=30)
            update_expression += ', subscription_end = :end_date'
            expression_values[':end_date'] = end_date.isoformat()
        
        user_settings_table.update_item(
            Key={'user_id': user_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        logger.info(f"Updated subscription for user {user_id}: {plan} - {status}")
        
    except Exception as e:
        logger.error(f"Error updating user subscription: {str(e)}")
        raise

def handle_payment_succeeded(event_data):
    """Handle successful payment"""
    payment_intent = event_data['object']
    metadata = payment_intent.get('metadata', {})
    
    user_id = metadata.get('user_id')
    payment_type = metadata.get('payment_type')
    
    if not user_id:
        logger.warning("No user_id in payment intent metadata")
        return
    
    if payment_type == 'subscription':
        plan = metadata.get('plan', 'pro')
        update_user_subscription(user_id, plan, 'active', payment_intent['id'])
    elif payment_type == 'invoice':
        # Handle invoice payment - could update project status, send notifications, etc.
        project_id = metadata.get('project_id')
        invoice_id = metadata.get('invoice_id')
        logger.info(f"Invoice payment succeeded: Project {project_id}, Invoice {invoice_id}")
        # Additional invoice handling logic can be added here

def handle_payment_failed(event_data):
    """Handle failed payment"""
    payment_intent = event_data['object']
    metadata = payment_intent.get('metadata', {})
    
    user_id = metadata.get('user_id')
    payment_type = metadata.get('payment_type')
    
    if user_id and payment_type == 'subscription':
        # Update subscription status to failed
        update_user_subscription(user_id, 'pro', 'payment_failed', payment_intent['id'])

def lambda_handler(event, context):
    """Handle Stripe webhook events"""
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
        'Content-Type': 'application/json'
    }
    
    try:
        # Get Stripe configuration
        stripe_config = get_stripe_config()
        stripe.api_key = stripe_config['stripe_secret_key']
        webhook_secret = stripe_config['stripe_webhook_secret']
        
        # Get the request body and signature
        payload = event.get('body', '')
        sig_header = event.get('headers', {}).get('stripe-signature', '')
        
        if not payload or not sig_header:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Missing payload or signature'})
            }
        
        # Verify the webhook signature
        try:
            webhook_event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except ValueError as e:
            logger.error(f"Invalid payload: {str(e)}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Invalid payload'})
            }
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {str(e)}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Invalid signature'})
            }
        
        # Handle the event
        event_type = webhook_event['type']
        event_data = webhook_event['data']
        
        logger.info(f"Received Stripe webhook: {event_type}")
        
        if event_type == 'payment_intent.succeeded':
            handle_payment_succeeded(event_data)
        elif event_type == 'payment_intent.payment_failed':
            handle_payment_failed(event_data)
        elif event_type == 'customer.subscription.created':
            # Handle subscription creation
            subscription = event_data['object']
            logger.info(f"Subscription created: {subscription['id']}")
        elif event_type == 'customer.subscription.updated':
            # Handle subscription updates
            subscription = event_data['object']
            logger.info(f"Subscription updated: {subscription['id']}")
        elif event_type == 'invoice.payment_succeeded':
            # Handle invoice payment
            invoice = event_data['object']
            logger.info(f"Invoice payment succeeded: {invoice['id']}")
        else:
            logger.info(f"Unhandled event type: {event_type}")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'received': True})
        }
    
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Webhook processing failed'})
        }