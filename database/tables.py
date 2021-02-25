from database.base import Base
from flask_login import UserMixin
from sqlalchemy import Boolean, Column, Integer, String, Text


class User(Base):
    __tablename__ = "user"
    email = Column(Text, primary_key=True)
    password = Column(String)
    ssh_key = Column(Text)
    email_token = Column(Text)
    confirmed_email = Column(Boolean, default=False)
    is_authorized = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)


    def is_active(self):
        """True, as all users are active."""
        return True


    def get_id(self):
        """Return the email address to satisfy Flask-Login's requirements."""
        return self.email


    def is_authenticated(self):
        """Return True if the user is authenticated."""
        return self.authenticated


    def is_anonymous(self):
        """False, as anonymous users aren't supported."""
        return False


class Worker(Base):
    __tablename__ = "worker"
    name = Column(Text, primary_key=True)
    type = Column(Text)
    ip = Column(Text)
    port = Column(Integer)
    token = Column(Text)
