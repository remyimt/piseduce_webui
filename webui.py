from database.connector import open_session, close_session
from database.tables import User
from datetime import datetime
from flask import Flask, render_template
from flask_login import LoginManager, UserMixin
from lib.config_loader import load_config
from api.admin import b_admin
from api.login import b_login
from api.user import b_user
import jinja2, logging, os, sys


# Create the application
webui = Flask(__name__)
webui.secret_key = load_config()["pwd_secret_key"]
# Maximum size in bytes of the uploads (the size of the 64-bit piseduce image)
webui.config['MAX_CONTENT_PATH'] = 3000000000
# Add routes from blueprints
webui.register_blueprint(b_login)
webui.register_blueprint(b_admin, url_prefix="/admin/")
webui.register_blueprint(b_user, url_prefix="/user/")


# Jinja filters to render templates
@webui.template_filter()
def timestamp_to_date(timestamp):
    return datetime.fromtimestamp(timestamp)


# Flask_login configuration (session manager)
class LoginUser(UserMixin):
    pass

login_manager = LoginManager()
login_manager.init_app(webui)
login_manager.login_view = "login.login"

@login_manager.user_loader
def load_user(user_email):
    db = open_session()
    db_user = db.query(User).filter(User.email == user_email).first()
    auth_user = None
    if db_user is not None and db_user.is_authorized:
        flask_user = LoginUser()
        flask_user.email = db_user.email
        flask_user.is_admin = db_user.is_admin
        auth_user = flask_user
    close_session(db)
    return auth_user


# HTML pages for error
@webui.errorhandler(403)
def page_not_found(e):
    # note that we set the 404 status explicitly
    return render_template('403.html'), 403


# Start the web interface
if __name__ == "__main__":
    logging.basicConfig(filename="info_webui.log", level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    if not os.path.isfile("secret.key"):
        msg = """Please, generate the secret key used to share passwords with agents:
            python3 generate_password_key.py
        """
        print(msg)
        logging.error(msg)
        sys.exit(13)
    port_number = load_config()["port_number"]
    webui.run(port=port_number, host="0.0.0.0")
