import json
import os
import boto3
import base64
from datetime import datetime
from botocore.exceptions import ClientError

def lambda_handler(event, context):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'PUT,OPTIONS'
    }

    try:
        # Parse request body
        body = json.loads(event['body'])
        timestamp = body.get('timestamp')
        updates = body.get('updates', {})
        
        # Get token from Authorization header
        token = None
        if event.get('headers'):
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

        dynamodb = boto3.resource('dynamodb')
        time_entries_table = dynamodb.Table(os.environ['TIME_ENTRIES_TABLE'])

        # Validate that the user owns this timesheet entry
        try:
            response = time_entries_table.get_item(
                Key={
                    'user_id': user_id,
                    'timestamp': timestamp
                }
            )
            
            if 'Item' not in response:
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({'error': 'Timesheet entry not found'})
                }

            # Prepare update expression
            update_expression_parts = []
            expression_attribute_values = {}
            expression_attribute_names = {}
            
            allowed_updates = ['hours', 'description', 'project']
            
            for key, value in updates.items():
                if key in allowed_updates:
                    attr_name = f'#{key}'
                    attr_value = f':{key}'
                    update_expression_parts.append(f'{attr_name} = {attr_value}')
                    expression_attribute_names[attr_name] = key
                    expression_attribute_values[attr_value] = value

            if not update_expression_parts:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'No valid updates provided'})
                }

            # Add last_modified timestamp
            update_expression_parts.append('#last_modified = :last_modified')
            expression_attribute_names['#last_modified'] = 'last_modified'
            expression_attribute_values[':last_modified'] = datetime.utcnow().isoformat() + 'Z'

            update_expression = 'SET ' + ', '.join(update_expression_parts)

            # Update the timesheet entry
            response = time_entries_table.update_item(
                Key={
                    'user_id': user_id,
                    'timestamp': timestamp
                },
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values,
                ReturnValues='ALL_NEW'
            )

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Timesheet entry updated successfully',
                    'updatedEntry': response['Attributes']
                })
            }

        except ClientError as e:
            print(f"DynamoDB error: {e}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': 'Database error'})
            }

    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        print(f"Error updating timesheet: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }