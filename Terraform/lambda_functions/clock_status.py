import json
import os
import boto3
import base64
from datetime import datetime, timezone
from botocore.exceptions import ClientError

def lambda_handler(event, context):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    }

    try:
        # Get token from query parameters or headers
        token = None
        if event.get('queryStringParameters') and event['queryStringParameters']:
            token = event['queryStringParameters'].get('token')
        
        if not token and event.get('headers'):
            auth_header = event['headers'].get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.replace('Bearer ', '')

        if not token:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Missing token'})
            }

        # Simple JWT parsing without verification (temporary)
        try:
            # Split JWT token and decode payload
            parts = token.split('.')
            if len(parts) != 3:
                raise ValueError("Invalid token format")
            
            # Decode payload (add padding if needed)
            payload = parts[1]
            payload += '=' * (4 - len(payload) % 4)  # Add padding
            decoded_bytes = base64.urlsafe_b64decode(payload)
            decoded = json.loads(decoded_bytes.decode('utf-8'))
            
            user_id = decoded.get('sub')
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({'error': 'Invalid token'})
                }
        except Exception as e:
            print(f"Token decode error: {e}")
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Invalid token'})
            }

        # Get current session status
        dynamodb = boto3.resource('dynamodb')
        user_sessions_table = dynamodb.Table(os.environ['USER_SESSIONS_TABLE'])
        
        try:
            response = user_sessions_table.get_item(
                Key={'user_id': user_id}
            )
            
            item = response.get('Item')
            
            status = {
                'userId': user_id,
                'status': 'in' if (item and item.get('status') == 'clocked_in') else 'out',
                'isClockedIn': item.get('status') == 'clocked_in' if item else False,
                'lastUpdated': item.get('last_updated') if item else None,
                'clockInTime': item.get('clock_in_time') if item else None
            }

            # If clocked in, calculate current session time
            if status['isClockedIn'] and status['clockInTime']:
                clock_in_time = datetime.fromisoformat(status['clockInTime'].replace('Z', '+00:00'))
                current_time = datetime.now(timezone.utc)
                current_session_hours = (current_time - clock_in_time).total_seconds() / 3600
                status['currentSessionHours'] = round(current_session_hours, 2)

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(status)
            }
            
        except ClientError as e:
            print(f"DynamoDB error: {e}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': 'Database error'})
            }

    except Exception as e:
        print(f"Error getting clock status: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }