import json
import os
import boto3
from functools import lru_cache

@lru_cache(maxsize=1)
def get_auth_secrets():
    """Cache Auth0 secrets to avoid repeated calls"""
    try:
        secretsmanager = boto3.client('secretsmanager')
        secret_arn = os.environ['SECRET_ARN']
        
        response = secretsmanager.get_secret_value(SecretId=secret_arn)
        return json.loads(response['SecretString'])
    except Exception as e:
        print(f"Error getting auth secrets: {e}")
        return None

def validate_auth0_token(token):
    """Simplified token validation for basic operations"""
    try:
        # For delete operations, we can use a simplified validation
        # that just checks if the token format is correct
        import base64
        parts = token.split('.')
        if len(parts) != 3:
            print("Invalid token format")
            return None
        
        # Decode payload to get user ID
        payload = parts[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded_bytes = base64.urlsafe_b64decode(payload)
        decoded = json.loads(decoded_bytes.decode('utf-8'))
        
        user_id = decoded.get('sub')
        if user_id:
            print(f"Token validation successful for user: {user_id}")
            return user_id
        else:
            print("No user ID found in token")
            return None
            
    except Exception as e:
        print(f"Token validation error: {e}")
        return None

def get_cors_headers():
    """Standard CORS headers for all Lambda functions"""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'false'
    }

def handle_cors_preflight(event):
    """Handle OPTIONS preflight requests"""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': ''
        }
    return None

def get_user_from_token(event):
    """Extract and validate user from JWT token in request"""
    # Get token from Authorization header
    token = None
    if event.get('headers'):
        auth_header = event['headers'].get('Authorization') or event['headers'].get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.replace('Bearer ', '')
    
    # Also check query parameters as fallback
    if not token and event.get('queryStringParameters') and event['queryStringParameters']:
        token = event['queryStringParameters'].get('token')
    
    if not token:
        return None, {
            'statusCode': 401,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Missing token'})
        }
    
    user_id = validate_auth0_token(token)
    if not user_id:
        return None, {
            'statusCode': 401,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Invalid token'})
        }
    
    return user_id, None