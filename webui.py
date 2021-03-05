from database.connector import open_session, close_session, load_worker_info
from database.tables import User
from flask import Flask, render_template
from flask_login import LoginManager, UserMixin
from lib.config_loader import load_config
from blueprint.admin import b_admin
from blueprint.login import b_login
from blueprint.user import b_user
import logging

# Create the application
webui = Flask(__name__)
webui.secret_key = load_config()["secret_key"]
# Add routes from blueprints
webui.register_blueprint(b_login)
webui.register_blueprint(b_admin, url_prefix="/admin/")
webui.register_blueprint(b_user, url_prefix="/user/")

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
    port_number = load_config()["port_number"]
    load_worker_info()
    webui.run(port=port_number, host="0.0.0.0")
