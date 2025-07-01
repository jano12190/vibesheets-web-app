import json
import os
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError
from auth_utils import get_cors_headers, handle_cors_preflight, get_user_from_token

def lambda_handler(event, context):
    headers = get_cors_headers()
    
    # Handle preflight OPTIONS request
    cors_response = handle_cors_preflight(event)
    if cors_response:
        return cors_response

    try:
        # Get and validate user from token
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error

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