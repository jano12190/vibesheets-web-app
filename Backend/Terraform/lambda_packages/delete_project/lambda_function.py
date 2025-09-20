import json
import os
import boto3
from auth_utils import get_user_from_token, handle_cors_preflight, get_cors_headers

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """Delete a project for the authenticated user"""
    
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
        
        # Delete the project
        projects_table.delete_item(
            Key={
                'user_id': user_id,
                'project_id': project_id
            }
        )
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'message': 'Project deleted successfully',
                'projectId': project_id
            })
        }
        
    except Exception as e:
        print(f"Error deleting project: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Internal server error'})
        }