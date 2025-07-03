import json
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

# Simple auth functions without JWT dependency
def get_cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    }

def handle_cors_preflight(event):
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
    
    if not token:
        return None, {
            'statusCode': 401,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Missing token'})
        }
    
    # Simple token validation - extract user ID from token payload without verification
    # This is for development/testing - in production, implement full JWT verification
    try:
        import base64
        # JWT tokens have 3 parts separated by dots
        parts = token.split('.')
        if len(parts) != 3:
            return None, {
                'statusCode': 401,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Invalid token format'})
            }
        
        # Decode payload (second part)
        # Add padding if needed
        payload_encoded = parts[1]
        missing_padding = len(payload_encoded) % 4
        if missing_padding:
            payload_encoded += '=' * (4 - missing_padding)
        
        payload_decoded = base64.urlsafe_b64decode(payload_encoded)
        payload = json.loads(payload_decoded)
        
        # Extract user_id from 'sub' field
        user_id = payload.get('sub')
        if not user_id:
            return None, {
                'statusCode': 401,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'No user ID in token'})
            }
            
    except Exception as e:
        print(f"Token parsing error: {e}")
        return None, {
            'statusCode': 401,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Invalid token'})
        }
    
    return user_id, None

def lambda_handler(event, context):
    print("Update timesheet lambda function started")
    
    try:
        headers = get_cors_headers()
        print("Got CORS headers")
        
        # Handle preflight OPTIONS request
        cors_response = handle_cors_preflight(event)
        if cors_response:
            print("Returning CORS preflight response")
            return cors_response
        
        print("Starting main handler logic")
        # Get HTTP method
        http_method = event.get('httpMethod', 'POST')
        
        # Debug logging
        print(f"Received event: {json.dumps(event)}")
        print(f"HTTP Method: {http_method}")
        
        # Get and validate user from token
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error

        dynamodb = boto3.resource('dynamodb')
        time_entries_table = dynamodb.Table(os.environ['TIME_ENTRIES_TABLE'])
        
        # Parse request body (only if present)
        body = {}
        if event.get('body'):
            try:
                body = json.loads(event['body'])
            except json.JSONDecodeError:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Invalid JSON in request body'})
                }
        
        timestamp = body.get('timestamp')
        
        print(f"Method routing - http_method: '{http_method}', timestamp: '{timestamp}'")
        
        if http_method == 'DELETE':
            print("Routing to DELETE handler")
            if not timestamp:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'timestamp is required for DELETE requests'})
                }
            return handle_delete_entry(time_entries_table, user_id, timestamp, headers)
        elif http_method == 'PUT':
            print("Routing to PUT handler")
            if not timestamp:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'timestamp is required for PUT requests'})
                }
            return handle_update_entry(time_entries_table, user_id, timestamp, body, headers)
        else:
            print(f"Unknown method: {http_method}")
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': f'Method not allowed: {http_method}'})
            }
    
    except Exception as e:
        print(f"Error in lambda_handler: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        
        # Return error with CORS headers
        error_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        }
        
        return {
            'statusCode': 500,
            'headers': error_headers,
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }

def handle_delete_entry(time_entries_table, user_id, timestamp, headers):
    """Handle DELETE request to delete a time entry"""
    try:
        # Check if entry exists and belongs to user
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
                'body': json.dumps({'error': 'Time entry not found'})
            }
        
        # Delete the entry
        time_entries_table.delete_item(
            Key={
                'user_id': user_id,
                'timestamp': timestamp
            }
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'message': 'Time entry deleted successfully'
            })
        }
        
    except ClientError as e:
        print(f"DynamoDB error: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Database error'})
        }

def handle_update_entry(time_entries_table, user_id, timestamp, body, headers):
    """Handle PUT request to update a time entry"""
    try:
        # Check if entry exists and belongs to user
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
                'body': json.dumps({'error': 'Time entry not found'})
            }

        # Handle time editing (clock_in_timestamp and clock_out_timestamp)
        if 'clock_in_timestamp' in body or 'clock_out_timestamp' in body:
            return handle_time_edit(time_entries_table, user_id, timestamp, body, headers)
        
        # Handle regular updates
        updates = body.get('updates', {})
        
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

def handle_time_edit(time_entries_table, user_id, timestamp, body, headers):
    """Handle editing of clock in/out times"""
    try:
        from decimal import Decimal
        from boto3.dynamodb.conditions import Key
        
        clock_in_timestamp = body.get('clock_in_timestamp')
        clock_out_timestamp = body.get('clock_out_timestamp')
        hours = body.get('hours', 0)
        
        # Get the original entry to determine its type
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
                'body': json.dumps({'error': 'Time entry not found'})
            }
        
        original_entry = response['Item']
        entry_type = original_entry.get('type')
        entry_date = original_entry.get('date')
        
        print(f"Editing entry: type={entry_type}, date={entry_date}, timestamp={timestamp}")
        print(f"Update data: clock_in={clock_in_timestamp}, clock_out={clock_out_timestamp}, hours={hours}")
        
        # If this is a clock_out entry, we need to update both clock_in and clock_out times
        if entry_type == 'clock_out':
            # Find the corresponding clock_in entry for this date
            clock_in_entry = None
            if clock_in_timestamp:
                # Look for existing clock_in entries on this date
                try:
                    clock_in_query = time_entries_table.query(
                        KeyConditionExpression=Key('user_id').eq(user_id),
                        FilterExpression=Key('date').eq(entry_date) & Key('type').eq('clock_in')
                    )
                    if clock_in_query['Items']:
                        # Update the clock_in entry's timestamp
                        clock_in_entry = clock_in_query['Items'][0]
                        old_clock_in_timestamp = clock_in_entry['timestamp']
                        
                        # Delete old clock_in entry
                        time_entries_table.delete_item(
                            Key={
                                'user_id': user_id,
                                'timestamp': old_clock_in_timestamp
                            }
                        )
                        
                        # Create new clock_in entry with updated time
                        time_entries_table.put_item(
                            Item={
                                'user_id': user_id,
                                'timestamp': clock_in_timestamp,
                                'date': entry_date,
                                'type': 'clock_in',
                                'hours': Decimal('0'),
                                'last_modified': datetime.utcnow().isoformat() + 'Z'
                            }
                        )
                except Exception as e:
                    print(f"Error updating clock_in entry: {e}")
            
            # Update the clock_out entry
            update_expression_parts = []
            expression_attribute_values = {}
            expression_attribute_names = {}
            
            if clock_in_timestamp:
                update_expression_parts.append('#clock_in_time = :clock_in_time')
                expression_attribute_names['#clock_in_time'] = 'clock_in_time'
                expression_attribute_values[':clock_in_time'] = clock_in_timestamp
            
            if clock_out_timestamp:
                # We need to delete this entry and recreate it with new timestamp
                time_entries_table.delete_item(
                    Key={
                        'user_id': user_id,
                        'timestamp': timestamp
                    }
                )
                
                # Recalculate hours if both times are provided
                new_hours = hours
                if clock_in_timestamp and clock_out_timestamp:
                    clock_in_dt = datetime.fromisoformat(clock_in_timestamp.replace('Z', '+00:00'))
                    clock_out_dt = datetime.fromisoformat(clock_out_timestamp.replace('Z', '+00:00'))
                    new_hours = (clock_out_dt - clock_in_dt).total_seconds() / 3600
                
                # Create new clock_out entry
                time_entries_table.put_item(
                    Item={
                        'user_id': user_id,
                        'timestamp': clock_out_timestamp,
                        'date': entry_date,
                        'type': 'clock_out',
                        'hours': Decimal(str(round(new_hours, 2))),
                        'clock_in_time': clock_in_timestamp or original_entry.get('clock_in_time'),
                        'last_modified': datetime.utcnow().isoformat() + 'Z'
                    }
                )
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True,
                        'message': 'Time entry updated successfully'
                    })
                }
            
            # If only clock_in_time or hours changed (no clock_out timestamp change)
            if hours > 0:
                update_expression_parts.append('#hours = :hours')
                expression_attribute_names['#hours'] = 'hours'
                expression_attribute_values[':hours'] = Decimal(str(hours))
            
            # Add last_modified timestamp
            update_expression_parts.append('#last_modified = :last_modified')
            expression_attribute_names['#last_modified'] = 'last_modified'
            expression_attribute_values[':last_modified'] = datetime.utcnow().isoformat() + 'Z'
            
            if update_expression_parts:
                update_expression = 'SET ' + ', '.join(update_expression_parts)
                
                time_entries_table.update_item(
                    Key={
                        'user_id': user_id,
                        'timestamp': timestamp
                    },
                    UpdateExpression=update_expression,
                    ExpressionAttributeNames=expression_attribute_names,
                    ExpressionAttributeValues=expression_attribute_values
                )
        
        # If this is a clock_in entry, just update its timestamp
        elif entry_type == 'clock_in' and clock_in_timestamp:
            # Delete and recreate with new timestamp
            time_entries_table.delete_item(
                Key={
                    'user_id': user_id,
                    'timestamp': timestamp
                }
            )
            
            time_entries_table.put_item(
                Item={
                    'user_id': user_id,
                    'timestamp': clock_in_timestamp,
                    'date': entry_date,
                    'type': 'clock_in',
                    'hours': Decimal('0'),
                    'last_modified': datetime.utcnow().isoformat() + 'Z'
                }
            )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'message': 'Time entry updated successfully'
            })
        }
        
    except ClientError as e:
        print(f"DynamoDB error: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Database error'})
        }

