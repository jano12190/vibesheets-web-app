import json
import os
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from auth_utils import get_user_from_token, handle_cors_preflight, get_cors_headers

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """Update an existing project for the authenticated user"""
    
    # Handle CORS preflight
    cors_response = handle_cors_preflight(event)
    if cors_response:
        return cors_response
    
    try:
        # Authenticate user
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error
        
        # Get project ID from path parameters
        project_id = event.get('pathParameters', {}).get('projectId')
        if not project_id:
            return {
                'statusCode': 400,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Missing project ID'})
            }
        
        # Parse request body
        try:
            body = json.loads(event.get('body', '{}'))
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Invalid JSON in request body'})
            }
        
        # Get projects table
        projects_table = dynamodb.Table(os.environ['PROJECTS_TABLE'])
        
        # Check if project exists and belongs to user
        existing_project = projects_table.get_item(
            Key={
                'user_id': user_id,
                'project_id': project_id
            }
        )
        
        if 'Item' not in existing_project:
            return {
                'statusCode': 404,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Project not found'})
            }
        
        project_item = existing_project['Item']
        
        # If updating status to active, check free tier limitation
        if body.get('status') == 'active' and project_item['status'] != 'active':
            active_projects_response = projects_table.query(
                IndexName='StatusIndex',
                KeyConditionExpression='user_id = :user_id AND #status = :status',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':user_id': user_id,
                    ':status': 'active'
                }
            )
            
            if active_projects_response['Items']:
                return {
                    'statusCode': 400,
                    'headers': get_cors_headers(),
                    'body': json.dumps({
                        'error': 'Free tier allows only one active project. Please archive your current project first.'
                    })
                }
        
        # Build update expression
        update_expression = "SET updated_date = :updated_date"
        expression_values = {
            ':updated_date': datetime.now(timezone.utc).isoformat()
        }
        expression_names = {}
        
        # Update allowed fields
        allowed_fields = {
            'name': 'name',
            'client': 'client',
            'status': 'status',
            'rate': 'rate',
            'rateType': 'rate_type',
            'description': 'description',
            'clientEmail': 'client_email',
            'clientAddress': 'client_address',
            'invoiceTerms': 'invoice_terms',
            'customDateRange': 'custom_date_range',
            'invoiceNotes': 'invoice_notes'
        }
        
        for frontend_field, db_field in allowed_fields.items():
            if frontend_field in body:
                if db_field == 'status':
                    expression_names['#status'] = 'status'
                    update_expression += ", #status = :status"
                    expression_values[':status'] = body[frontend_field]
                else:
                    update_expression += f", {db_field} = :{db_field}"
                    if frontend_field == 'rate':
                        expression_values[f':{db_field}'] = float(body[frontend_field])
                    else:
                        expression_values[f':{db_field}'] = body[frontend_field]
        
        # Update the project
        response = projects_table.update_item(
            Key={
                'user_id': user_id,
                'project_id': project_id
            },
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ExpressionAttributeNames=expression_names if expression_names else None,
            ReturnValues='ALL_NEW'
        )
        
        updated_item = response['Attributes']
        
        # Format response
        project = {
            'id': updated_item['project_id'],
            'name': updated_item['name'],
            'client': updated_item['client'],
            'status': updated_item['status'],
            'rate': float(updated_item['rate']),
            'rateType': updated_item.get('rate_type', 'hourly'),
            'description': updated_item.get('description', ''),
            'clientEmail': updated_item.get('client_email', ''),
            'clientAddress': updated_item.get('client_address', ''),
            'invoiceTerms': updated_item.get('invoice_terms', 'monthly'),
            'customDateRange': updated_item.get('custom_date_range', ''),
            'invoiceNotes': updated_item.get('invoice_notes', 'Thank you for your business!'),
            'totalHours': float(updated_item.get('total_hours', 0)),
            'thisWeek': float(updated_item.get('this_week', 0)),
            'createdDate': updated_item['created_date']
        }
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Project updated successfully',
                'project': project
            })
        }
        
    except Exception as e:
        print(f"Error updating project: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error'})
        }