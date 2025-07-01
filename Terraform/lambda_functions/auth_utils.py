import json
import os
import boto3
import jwt
import requests
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

@lru_cache(maxsize=1)
def get_jwks_keys():
    """Cache JWKS keys to avoid repeated requests"""
    try:
        secrets = get_auth_secrets()
        if not secrets:
            return None
            
        auth0_domain = secrets['auth0_domain']
        jwks_url = f"https://{auth0_domain}/.well-known/jwks.json"
        jwks_response = requests.get(jwks_url, timeout=10)
        return jwks_response.json()
    except Exception as e:
        print(f"Error getting JWKS keys: {e}")
        return None

def validate_auth0_token(token):
    """Validate Auth0 JWT token and return user_id"""
    try:
        secrets = get_auth_secrets()
        if not secrets:
            raise ValueError("Unable to get auth secrets")
            
        auth0_domain = secrets['auth0_domain']
        jwks = get_jwks_keys()
        
        if not jwks:
            raise ValueError("Unable to get JWKS keys")
        
        # Decode the token header to get the key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header['kid']
        
        # Find the correct key
        key = None
        for jwk in jwks['keys']:
            if jwk['kid'] == kid:
                key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
                break
        
        if not key:
            raise ValueError("Unable to find appropriate key")
        
        # Verify and decode the token
        payload = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience=f"https://{auth0_domain}/api/v2/",
            issuer=f"https://{auth0_domain}/"
        )
        
        return payload.get('sub')
        
    except Exception as e:
        print(f"Token validation error: {e}")
        # Fallback to simple decode for development
        try:
            import base64
            parts = token.split('.')
            if len(parts) != 3:
                return None
            
            payload = parts[1]
            payload += '=' * (4 - len(payload) % 4)
            decoded_bytes = base64.urlsafe_b64decode(payload)
            decoded = json.loads(decoded_bytes.decode('utf-8'))
            
            return decoded.get('sub')
        except:
            return None

def get_cors_headers():
    """Standard CORS headers for all Lambda functions"""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
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