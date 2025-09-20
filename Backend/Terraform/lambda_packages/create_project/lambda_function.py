import json
import os
import boto3
import uuid
from datetime import datetime, timezone
from auth_utils import get_user_from_token, handle_cors_preflight, get_cors_headers

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """Create a new project for the authenticated user"""
    
    # Handle CORS preflight
    cors_response = handle_cors_preflight(event)
    if cors_response:
        return cors_response
    
    try:
        # Authenticate user
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error
        
        # Parse request body
        try:
            body = json.loads(event.get('body', '{}'))
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Invalid JSON in request body'})
            }
        
        # Validate required fields
        required_fields = ['name', 'client', 'rate']
        for field in required_fields:
            if not body.get(field):
                return {
                    'statusCode': 400,
                    'headers': get_cors_headers(),
                    'body': json.dumps({'error': f'Missing required field: {field}'})
                }
        
        # Get projects table
        projects_table = dynamodb.Table(os.environ['PROJECTS_TABLE'])
        
        # Check for existing active projects (free tier limitation)
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
        
        # Generate project ID and timestamps
        project_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        created_date = now.isoformat()
        
        # Create project item
        project_item = {
            'user_id': user_id,
            'project_id': project_id,
            'name': body['name'],
            'client': body['client'],
            'status': 'active',
            'rate': float(body['rate']),
            'rate_type': body.get('rateType', 'hourly'),
            'description': body.get('description', ''),
            'client_email': body.get('clientEmail', ''),
            'client_address': body.get('clientAddress', ''),
            'invoice_terms': body.get('invoiceTerms', 'monthly'),
            'custom_date_range': body.get('customDateRange', ''),
            'invoice_notes': body.get('invoiceNotes', 'Thank you for your business!'),
            'total_hours': 0.0,
            'this_week': 0.0,
            'created_date': created_date,
            'updated_date': created_date
        }
        
        # Save to DynamoDB
        projects_table.put_item(Item=project_item)
        
        # Return created project
        return {
            'statusCode': 201,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Project created successfully',
                'project': {
                    'id': project_id,
                    'name': project_item['name'],
                    'client': project_item['client'],
                    'status': project_item['status'],
                    'rate': project_item['rate'],
                    'rateType': project_item['rate_type'],
                    'description': project_item['description'],
                    'clientEmail': project_item['client_email'],
                    'clientAddress': project_item['client_address'],
                    'invoiceTerms': project_item['invoice_terms'],
                    'customDateRange': project_item['custom_date_range'],
                    'invoiceNotes': project_item['invoice_notes'],
                    'totalHours': project_item['total_hours'],
                    'thisWeek': project_item['this_week'],
                    'createdDate': project_item['created_date']
                }
            })
        }
        
    except Exception as e:
        print(f"Error creating project: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error'})
        }