from database.tables import User
from flask_login import current_user, login_required
import flask

b_user = flask.Blueprint("user", __name__, template_folder="templates/")

@b_user.route("/reserve")
@login_required
def reserve():
    return flask.render_template("reserve.html", admin = current_user.is_admin, active_btn = "user_reserve")



