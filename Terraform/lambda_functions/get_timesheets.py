import json
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from auth_utils import get_cors_headers, handle_cors_preflight, get_user_from_token

def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(item) for item in obj]
    else:
        return obj

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

        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        start_date = query_params.get('start_date') or query_params.get('startDate')
        end_date = query_params.get('end_date') or query_params.get('endDate')
        period = query_params.get('period')

        dynamodb = boto3.resource('dynamodb')
        time_entries_table = dynamodb.Table(os.environ['TIME_ENTRIES_TABLE'])

        # Build query
        query_kwargs = {
            'KeyConditionExpression': Key('user_id').eq(user_id),
            'ScanIndexForward': False  # Most recent first
        }

        # Add date filtering if provided
        if start_date and end_date:
            query_kwargs['FilterExpression'] = Key('date').between(start_date, end_date)
        elif period:
            now = datetime.utcnow()
            
            if period == 'today':
                filter_date = now.strftime('%Y-%m-%d')
                query_kwargs['FilterExpression'] = Key('date').eq(filter_date)
            elif period == 'this-week':
                start_of_week = now - timedelta(days=now.weekday())
                end_of_week = start_of_week + timedelta(days=6)
                query_kwargs['FilterExpression'] = Key('date').between(
                    start_of_week.strftime('%Y-%m-%d'),
                    end_of_week.strftime('%Y-%m-%d')
                )
            elif period == 'this-month':
                start_of_month = now.replace(day=1)
                # Get last day of month
                if now.month == 12:
                    end_of_month = now.replace(year=now.year + 1, month=1, day=1) - timedelta(days=1)
                else:
                    end_of_month = now.replace(month=now.month + 1, day=1) - timedelta(days=1)
                
                query_kwargs['FilterExpression'] = Key('date').between(
                    start_of_month.strftime('%Y-%m-%d'),
                    end_of_month.strftime('%Y-%m-%d')
                )

        try:
            response = time_entries_table.query(**query_kwargs)
            items = response['Items']
            
            # Group entries by date and calculate daily totals
            grouped_entries = {}
            total_hours = 0

            for item in items:
                date = item['date']
                if date not in grouped_entries:
                    grouped_entries[date] = {
                        'date': date,
                        'entries': [],
                        'totalHours': 0
                    }
                
                grouped_entries[date]['entries'].append(item)
                if item.get('type') == 'clock_out' and item.get('hours'):
                    grouped_entries[date]['totalHours'] += float(item['hours'])
                    total_hours += float(item['hours'])

            # Convert to array and sort by date
            timesheets = list(grouped_entries.values())
            timesheets.sort(key=lambda x: x['date'], reverse=True)

            # Convert all data to be JSON serializable
            response_data = {
                'timesheets': timesheets,
                'entries': [entry for day in timesheets for entry in day['entries']],
                'totalHours': round(total_hours, 2),
                'period': period or 'custom',
                'startDate': start_date,
                'endDate': end_date
            }
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(decimal_to_float(response_data))
            }
            
        except ClientError as e:
            print(f"DynamoDB error: {e}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': 'Database error'})
            }

    except Exception as e:
        print(f"Error getting timesheets: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }