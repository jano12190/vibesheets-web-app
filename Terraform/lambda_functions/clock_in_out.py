import json
import os
import boto3
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError
from auth_utils import get_cors_headers, handle_cors_preflight, get_user_from_token

def lambda_handler(event, context):
    headers = get_cors_headers()
    
    # Handle preflight OPTIONS request
    cors_response = handle_cors_preflight(event)
    if cors_response:
        return cors_response

    try:
        # Parse request body
        body = json.loads(event['body'])
        action = body.get('action')  # 'in' or 'out'
        
        # Get and validate user from token
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error

        dynamodb = boto3.resource('dynamodb')
        time_entries_table = dynamodb.Table(os.environ['TIME_ENTRIES_TABLE'])
        user_sessions_table = dynamodb.Table(os.environ['USER_SESSIONS_TABLE'])

        timestamp = datetime.utcnow().isoformat() + 'Z'
        date = timestamp.split('T')[0]

        if action == 'in':
            # Clock in
            time_entries_table.put_item(
                Item={
                    'user_id': user_id,
                    'timestamp': timestamp,
                    'date': date,
                    'type': 'clock_in',
                    'hours': Decimal('0')
                }
            )

            # Update user session
            user_sessions_table.put_item(
                Item={
                    'user_id': user_id,
                    'status': 'clocked_in',
                    'clock_in_time': timestamp,
                    'last_updated': timestamp
                }
            )

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Clocked in successfully',
                    'timestamp': timestamp
                })
            }

        elif action == 'out':
            # Get current session
            try:
                session_response = user_sessions_table.get_item(
                    Key={'user_id': user_id}
                )
                session_item = session_response.get('Item')
                
                if not session_item or session_item.get('status') != 'clocked_in':
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Not currently clocked in'})
                    }

                clock_in_time = datetime.fromisoformat(session_item['clock_in_time'].replace('Z', '+00:00'))
                clock_out_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                hours_worked = Decimal(str(round((clock_out_time - clock_in_time).total_seconds() / 3600, 2)))

                # Create clock out entry
                time_entries_table.put_item(
                    Item={
                        'user_id': user_id,
                        'timestamp': timestamp,
                        'date': date,
                        'type': 'clock_out',
                        'hours': hours_worked,
                        'clock_in_time': session_item['clock_in_time']
                    }
                )

                # Update user session
                user_sessions_table.put_item(
                    Item={
                        'user_id': user_id,
                        'status': 'clocked_out',
                        'last_updated': timestamp
                    }
                )

                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True,
                        'message': 'Clocked out successfully',
                        'timestamp': timestamp,
                        'hours': float(hours_worked)
                    })
                }

            except ClientError as e:
                print(f"DynamoDB error: {e}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'Database error'})
                }

        else:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Invalid action. Use "in" or "out"'})
            }

    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        print(f"Error in clock in/out: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }

