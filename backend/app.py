import os
import math
import secrets
from datetime import datetime, date, timedelta
from functools import wraps

from flask import Flask, redirect, url_for, session, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv

from models import db, User, CheckIn

load_dotenv()

# Science Park Amsterdam coordinates
SCIENCE_PARK_LAT = 52.3547
SCIENCE_PARK_LNG = 4.9543
# Haarlemmerstraat 58 Amsterdam coordinates (TESTING)
# SCIENCE_PARK_LAT = 52.3803
# SCIENCE_PARK_LNG = 4.8882
ALLOWED_RADIUS_METERS = 10000

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Database config
database_url = os.environ.get('DATABASE_URL', 'sqlite:///jochiesleague.db')
# Render uses postgres:// but SQLAlchemy needs postgresql://
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Session config for cross-origin
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

# Initialize extensions
db.init_app(app)

# CORS - allow frontend origin
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
CORS(app, 
     supports_credentials=True, 
     origins=[frontend_url, 'http://localhost:3000'],
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'OPTIONS'])

# Login manager
login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

# Simple token store (in production, use Redis or database)
# Maps token -> {user_id, expires}
auth_tokens = {}

# OAuth setup
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters using Haversine formula."""
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def get_user_from_token():
    """Get user from Bearer token in Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        token_data = auth_tokens.get(token)
        if token_data and token_data['expires'] > datetime.utcnow():
            return User.query.get(token_data['user_id'])
    return None

def api_login_required(f):
    """Decorator for API endpoints that require login."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Try session auth first, then token auth
        user = current_user if current_user.is_authenticated else get_user_from_token()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        # Store user for the request
        request.api_user = user
        return f(*args, **kwargs)
    return decorated_function

# ============ AUTH ROUTES ============

@app.route('/auth/login')
def login():
    """Redirect to Google OAuth."""
    redirect_uri = url_for('auth_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/callback')
def auth_callback():
    """Handle Google OAuth callback."""
    try:
        token = google.authorize_access_token()
        user_info = token.get('userinfo')
        
        if not user_info:
            return redirect(f"{frontend_url}?error=auth_failed")
        
        # Find or create user
        user = User.query.get(user_info['sub'])
        if not user:
            user = User(
                id=user_info['sub'],
                email=user_info['email'],
                name=user_info['name'],
                picture=user_info.get('picture')
            )
            db.session.add(user)
            db.session.commit()
        else:
            # Update user info
            user.name = user_info['name']
            user.picture = user_info.get('picture')
            db.session.commit()
        
        login_user(user)
        
        # Generate auth token for mobile/cross-origin support
        auth_token = secrets.token_urlsafe(32)
        auth_tokens[auth_token] = {
            'user_id': user.id,
            'expires': datetime.utcnow() + timedelta(days=30)
        }
        
        # Clean up expired tokens
        now = datetime.utcnow()
        expired = [t for t, data in auth_tokens.items() if data['expires'] < now]
        for t in expired:
            del auth_tokens[t]
        
        return redirect(f"{frontend_url}?auth_token={auth_token}")
    
    except Exception as e:
        # Log the error and redirect to frontend with error
        print(f"Auth callback error: {e}")
        return redirect(f"{frontend_url}?error=auth_error")

@app.route('/auth/logout')
def logout():
    """Log out the current user."""
    logout_user()
    return redirect(frontend_url)

@app.route('/auth/user')
def get_current_user():
    """Get current logged-in user info."""
    # Try session auth first, then token auth
    user = current_user if current_user.is_authenticated else get_user_from_token()
    if user:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'picture': user.picture
            }
        })
    return jsonify({'authenticated': False})

# ============ CHECK-IN ROUTES ============

@app.route('/api/verify-location', methods=['POST'])
@api_login_required
def verify_location():
    """Verify user is at Science Park (step 1 of check-in)."""
    user = request.api_user
    data = request.get_json()
    
    if not data or 'latitude' not in data or 'longitude' not in data:
        return jsonify({'error': 'Missing coordinates'}), 400
    
    lat = data['latitude']
    lng = data['longitude']
    
    # Calculate distance to Science Park
    distance = haversine_distance(lat, lng, SCIENCE_PARK_LAT, SCIENCE_PARK_LNG)
    
    if distance > ALLOWED_RADIUS_METERS:
        return jsonify({
            'error': 'Too far from Science Park',
            'distance': round(distance, 1),
            'allowed_radius': ALLOWED_RADIUS_METERS
        }), 400
    
    # Check if already checked in today
    today = date.today()
    existing = CheckIn.query.filter_by(
        user_id=user.id,
        check_in_date=today
    ).first()
    
    if existing:
        return jsonify({
            'error': 'Already checked in today',
            'check_in_time': existing.check_in_time.isoformat()
        }), 400
    
    return jsonify({
        'success': True,
        'message': 'Location verified! Take a photo to complete check-in.',
        'distance': round(distance, 1),
        'latitude': lat,
        'longitude': lng
    })


@app.route('/api/checkin', methods=['POST'])
@api_login_required
def checkin():
    """Complete check-in with photo (step 2)."""
    user = request.api_user
    data = request.get_json()
    
    if not data or 'latitude' not in data or 'longitude' not in data:
        return jsonify({'error': 'Missing coordinates'}), 400
    
    if not data.get('photo'):
        return jsonify({'error': 'Photo is required'}), 400
    
    lat = data['latitude']
    lng = data['longitude']
    photo_data = data['photo']
    
    # Verify location again (in case of tampering)
    distance = haversine_distance(lat, lng, SCIENCE_PARK_LAT, SCIENCE_PARK_LNG)
    
    if distance > ALLOWED_RADIUS_METERS:
        return jsonify({
            'error': 'Too far from Science Park',
            'distance': round(distance, 1),
            'allowed_radius': ALLOWED_RADIUS_METERS
        }), 400
    
    # Check if already checked in today
    today = date.today()
    existing = CheckIn.query.filter_by(
        user_id=user.id,
        check_in_date=today
    ).first()
    
    if existing:
        return jsonify({
            'error': 'Already checked in today',
            'check_in_time': existing.check_in_time.isoformat()
        }), 400
    
    # Create check-in with photo
    checkin = CheckIn(
        user_id=user.id,
        check_in_date=today,
        check_in_time=datetime.utcnow(),
        latitude=lat,
        longitude=lng,
        photo_data=photo_data
    )
    db.session.add(checkin)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Checked in successfully!',
        'check_in_time': checkin.check_in_time.isoformat(),
        'distance': round(distance, 1)
    })

@app.route('/api/status')
@api_login_required
def get_status():
    """Get current user's check-in status for today."""
    user = request.api_user
    today = date.today()
    checkin = CheckIn.query.filter_by(
        user_id=user.id,
        check_in_date=today
    ).first()
    
    if checkin:
        return jsonify({
            'checked_in': True,
            'check_in_time': checkin.check_in_time.isoformat()
        })
    return jsonify({'checked_in': False})

# ============ LEADERBOARD ROUTES ============

@app.route('/api/leaderboard')
def get_leaderboard():
    """Get today's leaderboard."""
    today = date.today()
    checkins = CheckIn.query.filter_by(check_in_date=today)\
        .order_by(CheckIn.check_in_time.asc())\
        .all()
    
    leaderboard = []
    for i, checkin in enumerate(checkins):
        leaderboard.append({
            'rank': i + 1,
            'name': checkin.user.name,
            'picture': checkin.user.picture,
            'check_in_time': checkin.check_in_time.isoformat(),
            'photo': checkin.photo_data
        })
    
    return jsonify({
        'date': today.isoformat(),
        'leaderboard': leaderboard
    })

@app.route('/api/history')
def get_history():
    """Get all-time check-in history (last 30 days)."""
    from sqlalchemy import func
    
    # Get unique dates with check-ins, ordered by date desc
    dates_with_checkins = db.session.query(CheckIn.check_in_date)\
        .distinct()\
        .order_by(CheckIn.check_in_date.desc())\
        .limit(30)\
        .all()
    
    history = []
    for (check_date,) in dates_with_checkins:
        checkins = CheckIn.query.filter_by(check_in_date=check_date)\
            .order_by(CheckIn.check_in_time.asc())\
            .all()
        
        day_data = {
            'date': check_date.isoformat(),
            'entries': [{
                'rank': i + 1,
                'name': c.user.name,
                'picture': c.user.picture,
                'check_in_time': c.check_in_time.isoformat()
            } for i, c in enumerate(checkins)]
        }
        history.append(day_data)
    
    return jsonify({'history': history})

# ============ HEALTH CHECK ============

@app.route('/health')
def health():
    """Health check endpoint for Render."""
    return jsonify({'status': 'healthy'})

# ============ CREATE TABLES ============

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
