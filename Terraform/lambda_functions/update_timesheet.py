import json
import os
import boto3
from datetime import datetime
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
        timestamp = body.get('timestamp')
        updates = body.get('updates', {})
        
        # Get and validate user from token
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error

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