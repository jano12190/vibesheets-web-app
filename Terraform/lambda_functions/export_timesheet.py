import json
import os
import boto3
import base64
import csv
import io
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

def lambda_handler(event, context):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }

    try:
        # Parse request body
        body = json.loads(event['body'])
        start_date = body.get('start_date')
        end_date = body.get('end_date')
        export_format = body.get('format', 'csv')
        
        # Get and validate user from token
        user_id, auth_error = get_user_from_token(event)
        if auth_error:
            return auth_error

        dynamodb = boto3.resource('dynamodb')
        time_entries_table = dynamodb.Table(os.environ['TIME_ENTRIES_TABLE'])

        # Query timesheet entries for the date range
        query_kwargs = {
            'KeyConditionExpression': Key('user_id').eq(user_id),
            'ScanIndexForward': True  # Oldest first for export
        }

        if start_date and end_date:
            query_kwargs['FilterExpression'] = Key('date').between(start_date, end_date)

        try:
            response = time_entries_table.query(**query_kwargs)
            items = response['Items']

            # Group entries by date and calculate daily totals
            daily_entries = {}
            for item in items:
                date = item['date']
                if date not in daily_entries:
                    daily_entries[date] = {
                        'date': date,
                        'clockInTime': None,
                        'clockOutTime': None,
                        'totalHours': 0,
                        'description': item.get('description', ''),
                        'project': item.get('project', '')
                    }

                if item.get('type') == 'clock_in':
                    daily_entries[date]['clockInTime'] = item['timestamp']
                elif item.get('type') == 'clock_out':
                    daily_entries[date]['clockOutTime'] = item['timestamp']
                    daily_entries[date]['totalHours'] = float(item.get('hours', 0))

            # Convert to sorted list
            sorted_entries = sorted(daily_entries.values(), key=lambda x: x['date'])

            if export_format == 'csv':
                # Generate CSV
                output = io.StringIO()
                writer = csv.writer(output)
                
                # Write headers
                writer.writerow(['Date', 'Clock In', 'Clock Out', 'Total Hours', 'Project', 'Description'])
                
                total_hours = 0
                for entry in sorted_entries:
                    clock_in_formatted = ''
                    clock_out_formatted = ''
                    
                    if entry['clockInTime']:
                        clock_in_time = datetime.fromisoformat(entry['clockInTime'].replace('Z', '+00:00'))
                        clock_in_formatted = clock_in_time.strftime('%H:%M:%S')
                    
                    if entry['clockOutTime']:
                        clock_out_time = datetime.fromisoformat(entry['clockOutTime'].replace('Z', '+00:00'))
                        clock_out_formatted = clock_out_time.strftime('%H:%M:%S')
                    
                    total_hours += entry['totalHours']
                    
                    writer.writerow([
                        entry['date'],
                        clock_in_formatted,
                        clock_out_formatted,
                        f"{entry['totalHours']:.2f}",
                        entry['project'],
                        entry['description']
                    ])
                
                # Add total row
                writer.writerow(['', '', '', '', '', ''])
                writer.writerow(['Total Hours:', '', '', f"{total_hours:.2f}", '', ''])
                
                csv_content = output.getvalue()
                output.close()

                return {
                    'statusCode': 200,
                    'headers': {
                        **headers,
                        'Content-Type': 'text/csv',
                        'Content-Disposition': f'attachment; filename="timesheet_{start_date}_to_{end_date}.csv"'
                    },
                    'body': csv_content
                }
            else:
                # Return JSON format
                total_hours = sum(entry['totalHours'] for entry in sorted_entries)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'entries': sorted_entries,
                        'totalHours': round(total_hours, 2),
                        'startDate': start_date,
                        'endDate': end_date,
                        'exportDate': datetime.utcnow().isoformat() + 'Z'
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
        print(f"Error exporting timesheet: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }