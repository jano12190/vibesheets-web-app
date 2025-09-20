import json
import os
import boto3
from auth_utils import get_user_from_token, handle_cors_preflight, get_cors_headers

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """Get all projects for the authenticated user"""
    
    # Handle CORS preflight
    cors_response = handle_cors_preflight(event)
    if cors_response:
        return cors_response
    
    try:
        # Authenticate user
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error
        
        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        status_filter = query_params.get('status')  # 'active' or 'archived'
        
        # Get projects table
        projects_table = dynamodb.Table(os.environ['PROJECTS_TABLE'])
        
        if status_filter:
            # Query by status using GSI
            response = projects_table.query(
                IndexName='StatusIndex',
                KeyConditionExpression='user_id = :user_id AND #status = :status',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':user_id': user_id,
                    ':status': status_filter
                }
            )
        else:
            # Get all projects for user
            response = projects_table.query(
                KeyConditionExpression='user_id = :user_id',
                ExpressionAttributeValues={':user_id': user_id}
            )
        
        # Format projects for frontend
        projects = []
        for item in response['Items']:
            project = {
                'id': item['project_id'],
                'name': item['name'],
                'client': item['client'],
                'status': item['status'],
                'rate': float(item['rate']),
                'rateType': item.get('rate_type', 'hourly'),
                'description': item.get('description', ''),
                'clientEmail': item.get('client_email', ''),
                'clientAddress': item.get('client_address', ''),
                'invoiceTerms': item.get('invoice_terms', 'monthly'),
                'customDateRange': item.get('custom_date_range', ''),
                'invoiceNotes': item.get('invoice_notes', 'Thank you for your business!'),
                'totalHours': float(item.get('total_hours', 0)),
                'thisWeek': float(item.get('this_week', 0)),
                'createdDate': item['created_date']
            }
            projects.append(project)
        
        # Sort by creation date (newest first)
        projects.sort(key=lambda x: x['createdDate'], reverse=True)
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'projects': projects,
                'count': len(projects)
            })
        }
        
    except Exception as e:
        print(f"Error getting projects: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error'})
        }