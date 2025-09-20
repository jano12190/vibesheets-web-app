import json
import os
import boto3
import base64
import csv
import io
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
# Simple auth functions without external dependencies
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
    """Extract user from JWT token in request"""
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
    
    # Simple token parsing without verification
    try:
        import base64
        parts = token.split('.')
        if len(parts) != 3:
            return None, {
                'statusCode': 401,
                'headers': get_cors_headers(),
                'body': json.dumps({'error': 'Invalid token format'})
            }
        
        payload_encoded = parts[1]
        missing_padding = len(payload_encoded) % 4
        if missing_padding:
            payload_encoded += '=' * (4 - missing_padding)
        
        payload_decoded = base64.urlsafe_b64decode(payload_encoded)
        payload = json.loads(payload_decoded)
        
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
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

def lambda_handler(event, context):
    headers = get_cors_headers()
    
    # Handle preflight OPTIONS request
    cors_response = handle_cors_preflight(event)
    if cors_response:
        return cors_response

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

            if export_format == 'pdf' or export_format == 'csv':
                # Generate PDF
                buffer = io.BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=letter)
                styles = getSampleStyleSheet()
                
                # Build the PDF content
                elements = []
                
                # Title
                title = Paragraph(f"Timesheet Report: {start_date} to {end_date}", styles['Title'])
                elements.append(title)
                elements.append(Spacer(1, 12))
                
                # Table data
                data = [['Date', 'Clock In', 'Clock Out', 'Total Hours']]
                
                total_hours = 0
                for entry in sorted_entries:
                    clock_in_formatted = ''
                    clock_out_formatted = ''
                    
                    if entry['clockInTime']:
                        clock_in_time = datetime.fromisoformat(entry['clockInTime'].replace('Z', '+00:00'))
                        clock_in_formatted = clock_in_time.strftime('%I:%M %p')
                    
                    if entry['clockOutTime']:
                        clock_out_time = datetime.fromisoformat(entry['clockOutTime'].replace('Z', '+00:00'))
                        clock_out_formatted = clock_out_time.strftime('%I:%M %p')
                    
                    total_hours += entry['totalHours']
                    
                    data.append([
                        entry['date'],
                        clock_in_formatted,
                        clock_out_formatted,
                        f"{entry['totalHours']:.2f}h"
                    ])
                
                # Add total row
                data.append(['', '', 'Total:', f"{total_hours:.2f}h"])
                
                # Create table
                table = Table(data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 14),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
                    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                elements.append(table)
                
                # Build PDF
                doc.build(elements)
                
                pdf_content = buffer.getvalue()
                buffer.close()
                
                # Encode as base64 for API Gateway
                pdf_b64 = base64.b64encode(pdf_content).decode('utf-8')

                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': f'attachment; filename="timesheet_{start_date}_to_{end_date}.pdf"',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                        'Access-Control-Allow-Methods': 'POST,OPTIONS'
                    },
                    'body': pdf_b64,
                    'isBase64Encoded': True
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