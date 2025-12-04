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

from models import db, User, CheckIn, Reaction, UserSecret

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

# ============ REACTION ROUTES ============

@app.route('/api/react', methods=['POST'])
@api_login_required
def give_reaction():
    """Give a like or dislike to a check-in."""
    user = request.api_user
    data = request.get_json()
    
    if not data or 'checkin_id' not in data or 'reaction_type' not in data:
        return jsonify({'error': 'Missing checkin_id or reaction_type'}), 400
    
    checkin_id = data['checkin_id']
    reaction_type = data['reaction_type'].lower()
    
    if reaction_type not in ['like', 'dislike']:
        return jsonify({'error': 'reaction_type must be "like" or "dislike"'}), 400
    
    # Get the check-in
    checkin = CheckIn.query.get(checkin_id)
    if not checkin:
        return jsonify({'error': 'Check-in not found'}), 404
    
    today = date.today()
    
    # Rule: Check-in must be from today
    if checkin.check_in_date != today:
        return jsonify({'error': 'Can only react to today\'s check-ins'}), 400
    
    # Rule: Can't react to your own check-in
    if checkin.user_id == user.id:
        return jsonify({'error': 'Cannot react to your own check-in'}), 400
    
    # Rule: Must have checked in today to give reactions
    user_checkin = CheckIn.query.filter_by(
        user_id=user.id,
        check_in_date=today
    ).first()
    
    if not user_checkin:
        return jsonify({'error': 'Must check in today before giving reactions'}), 400
    
    # Check if user already reacted today
    existing_reaction = Reaction.query.filter_by(
        user_id=user.id,
        reaction_date=today
    ).first()
    
    if existing_reaction:
        # Update existing reaction
        existing_reaction.checkin_id = checkin_id
        existing_reaction.reaction_type = reaction_type
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Changed reaction to {reaction_type}',
            'reaction_type': reaction_type
        })
    else:
        # Create new reaction
        reaction = Reaction(
            user_id=user.id,
            checkin_id=checkin_id,
            reaction_type=reaction_type,
            reaction_date=today
        )
        db.session.add(reaction)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Gave {reaction_type} successfully',
            'reaction_type': reaction_type
        })

@app.route('/api/my-reaction')
@api_login_required
def get_my_reaction():
    """Get current user's reaction for today."""
    user = request.api_user
    today = date.today()
    
    reaction = Reaction.query.filter_by(
        user_id=user.id,
        reaction_date=today
    ).first()
    
    if reaction:
        return jsonify({
            'has_reacted': True,
            'reaction_type': reaction.reaction_type,
            'checkin_id': reaction.checkin_id
        })
    return jsonify({'has_reacted': False})

# ============ LEADERBOARD ROUTES ============

@app.route('/api/leaderboard')
def get_leaderboard():
    """Get today's leaderboard with reaction counts."""
    today = date.today()
    checkins = CheckIn.query.filter_by(check_in_date=today)\
        .order_by(CheckIn.check_in_time.asc())\
        .all()
    
    leaderboard = []
    for i, checkin in enumerate(checkins):
        # Count likes and dislikes for this check-in
        likes = Reaction.query.filter_by(
            checkin_id=checkin.id,
            reaction_type='like'
        ).count()
        
        dislikes = Reaction.query.filter_by(
            checkin_id=checkin.id,
            reaction_type='dislike'
        ).count()
        
        leaderboard.append({
            'rank': i + 1,
            'checkin_id': checkin.id,
            'name': checkin.user.name,
            'picture': checkin.user.picture,
            'check_in_time': checkin.check_in_time.isoformat(),
            'photo': checkin.photo_data,
            'likes': likes,
            'dislikes': dislikes
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

# ============ SECRETS TRACKING ============

# List of all available secrets
ALL_SECRETS = [
    'b_drag',          # Dragging B to make "Job" in title
    'job_spawn',       # Typing "job" to spawn flying Job
    'job_click',       # Clicking flying Job
    'chess',           # Playing chess
    'chess_victory',   # Beating the chess AI (unlocks Chess Jobje theme)
    'ian',             # Ian flashbang
    'smiling_friends', # Any smiling friends character
    'ranking',         # Ranking game
    'brainrot',        # Brainrot videos
    'fnaf',            # FNAF jumpscare
    'six_seven',       # 67 tilt
    'monkey_cursor',   # Triggered monkey cursor punishment
    'counter',         # Finding the secret counter
    'theme_kabouter',  # Unlocking Kabouter theme
    'bar_explosion'    # Shaking the progress bar until it explodes
]

@app.route('/api/secret/discover', methods=['POST'])
@api_login_required
def discover_secret():
    """Record that a user discovered a secret."""
    user = request.api_user
    data = request.get_json()
    
    if not data or 'secret_code' not in data:
        return jsonify({'error': 'Missing secret_code'}), 400
    
    secret_code = data['secret_code']
    
    if secret_code not in ALL_SECRETS:
        return jsonify({'error': 'Invalid secret_code'}), 400
    
    # Check if already discovered
    existing = UserSecret.query.filter_by(
        user_id=user.id,
        secret_code=secret_code
    ).first()
    
    if existing:
        return jsonify({
            'already_found': True,
            'message': 'You already found this secret!'
        })
    
    # Record the discovery
    secret = UserSecret(
        user_id=user.id,
        secret_code=secret_code
    )
    db.session.add(secret)
    db.session.commit()
    
    # Calculate progress
    total_found = UserSecret.query.filter_by(user_id=user.id).count()
    percentage = round((total_found / len(ALL_SECRETS)) * 100)
    
    return jsonify({
        'success': True,
        'message': f'New secret discovered: {secret_code}!',
        'total_found': total_found,
        'total_secrets': len(ALL_SECRETS),
        'percentage': percentage
    })

@app.route('/api/secret/progress')
@api_login_required
def get_secret_progress():
    """Get user's secret discovery progress."""
    user = request.api_user
    
    found_secrets = UserSecret.query.filter_by(user_id=user.id).all()
    found_codes = [s.secret_code for s in found_secrets]
    
    total_found = len(found_codes)
    percentage = round((total_found / len(ALL_SECRETS)) * 100)
    
    return jsonify({
        'total_found': total_found,
        'total_secrets': len(ALL_SECRETS),
        'percentage': percentage,
        'found_secrets': found_codes,
        'all_secrets': ALL_SECRETS
    })

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
