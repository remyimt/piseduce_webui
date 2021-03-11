from database.connector import open_session, close_session
from database.tables import User
from flask_login import current_user, login_user, login_required, logout_user
from werkzeug.security import generate_password_hash, check_password_hash
import flask


b_login = flask.Blueprint("login", __name__, template_folder="templates/")


@b_login.route("/")
def root():
    return flask.redirect("/login")


@b_login.route("/login")
def login():
    if current_user.is_authenticated:
        return flask.redirect("/user/reserve")
    else:
        return flask.render_template("login.html")


@b_login.route("/login-post", methods=["POST"])
def login_post():
    if current_user.is_authenticated:
        return flask.redirect("/user/reserve")
    form_data = flask.request.form
    authenticated = False
    if len(form_data["email"]) > 0 and len(form_data["pwd"]) > 0:
        db = open_session()
        user = db.query(User).filter_by(email = form_data["email"]).first()
        if user.is_authorized:
            if user is not None  and check_password_hash(user.password, form_data["pwd"]):
                authenticated = True
                login_user(user, remember=True)
            else:
                msg="Wrong email or password"
        else:
            msg = "User is not authorized to login"
        close_session(db)
    if authenticated:
        return flask.redirect("/user/reserve")
    else:
        return flask.redirect("/login?msg=%s" % msg)


@b_login.route("/signup")
def signup():
    if current_user.is_authenticated:
        return flask.redirect("/user/reserve")
    else:
        return flask.render_template("signup.html")


@b_login.route("/signup-post", methods=["POST"])
def signup_post():
    if current_user.is_authenticated:
        return flask.redirect("/user/reserve")
    form_data = flask.request.form
    if len(form_data["email"]) > 0 and len(form_data["pwd"]) > 0 and \
        len(form_data["confirm_pwd"]) > 0:
        db = open_session()
        email = form_data['email']
        user = db.query(User).filter_by(email=email).first()
        if user is not None:
            return flask.redirect("/login?msg='Can not sign up: email already exists'")
        password = form_data['pwd']
        confirm_pwd = form_data['confirm_pwd']
        user_created = False
        if password == confirm_pwd:
            new_user = User(email=email, password=generate_password_hash(password, method='sha256'))
            db.add(new_user)
            user_created = True
        close_session(db)
        if user_created:
            return flask.redirect("/login?msg='You can login with your account'")
        else:
            return flask.redirect("/signup?msg='Can not sign up: passwords do not match'")
    else:
        return flask.redirect("/signup?msg='Can not sign up: missing value(s)'")
    return flask.redirect("/login")


@b_login.route('/logout')
@login_required
def logout():
    logout_user()
    return flask.redirect("/login?msg=You are logged off")
