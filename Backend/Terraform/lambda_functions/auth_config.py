import json
import os
import boto3
from botocore.exceptions import ClientError

def lambda_handler(event, context):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Credentials': 'false'
    }
    
    # Handle preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        # Get secrets from AWS Secrets Manager
        secretsmanager = boto3.client('secretsmanager')
        secret_arn = os.environ['SECRET_ARN']
        
        response = secretsmanager.get_secret_value(SecretId=secret_arn)
        secrets = json.loads(response['SecretString'])

        # Return public configuration (no secrets)
        config = {
            'auth0': {
                'domain': secrets['auth0_domain'],
                'clientId': secrets['auth0_client_id'],
                'redirectUri': f"https://{os.environ['DOMAIN_NAME']}/",
                'audience': f"https://{secrets['auth0_domain']}/api/v2/",
                'scope': 'openid profile email'
            },
            'google': {
                'clientId': secrets['google_client_id']
            },
            'apiBaseUrl': f"https://api.{os.environ['DOMAIN_NAME']}"
        }

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(config)
        }
        
    except ClientError as e:
        print(f"Error fetching auth config: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }
    except Exception as e:
        print(f"Unexpected error: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }