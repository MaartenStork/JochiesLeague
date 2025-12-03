from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(255), primary_key=True)  # Google ID
    email = db.Column(db.String(255), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    picture = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    checkins = db.relationship('CheckIn', backref='user', lazy=True)

class CheckIn(db.Model):
    __tablename__ = 'checkins'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), db.ForeignKey('users.id'), nullable=False)
    check_in_date = db.Column(db.Date, nullable=False)
    check_in_time = db.Column(db.DateTime, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    photo_data = db.Column(db.Text, nullable=True)  # Base64 encoded photo
    
    reactions_received = db.relationship('Reaction', backref='checkin', lazy=True)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'check_in_date', name='unique_user_date'),
    )

class Reaction(db.Model):
    __tablename__ = 'reactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), db.ForeignKey('users.id'), nullable=False)  # Who gave the reaction
    checkin_id = db.Column(db.Integer, db.ForeignKey('checkins.id'), nullable=False)  # Which check-in
    reaction_type = db.Column(db.String(10), nullable=False)  # 'like' or 'dislike'
    reaction_date = db.Column(db.Date, nullable=False)  # Date the reaction was given
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='reactions_given')
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'reaction_date', name='unique_user_reaction_per_day'),
    )

class UserSecret(db.Model):
    __tablename__ = 'user_secrets'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), db.ForeignKey('users.id'), nullable=False)
    secret_code = db.Column(db.String(50), nullable=False)  # e.g. 'job_click', 'chess', 'ian'
    discovered_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='secrets_found')
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'secret_code', name='unique_user_secret'),
    )

