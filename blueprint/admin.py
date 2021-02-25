from database.connector import open_session, close_session, row2elem, row2dict
from database.tables import User, Worker
from flask_login import current_user, login_required
from lib.config_loader import load_config
import flask, functools, logging, requests


b_admin = flask.Blueprint("admin", __name__, template_folder="templates/")


def admin_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            flask.abort(403)
        return f(*args, **kwargs)
    return decorated_function


# User Management
@b_admin.route("/user")
@login_required
@admin_required
def list_user():
    pending_users = []
    authorized_users = []
    admin_users = []
    db = open_session()
    users = db.query(User).all()
    for u in users:
        user_dict = {
            "email": u.email,
            "confirmed_email": u.confirmed_email,
            "is_authorized": u.is_authorized,
            "is_admin": u.is_admin
        }
        if u.is_authorized:
            if u.is_admin:
                admin_users.append(user_dict)
            else:
                authorized_users.append(user_dict)
        else:
            pending_users.append(user_dict)
    close_session(db)
    return flask.render_template("user.html", admin = current_user.is_admin, active_btn = "admin_user",
        pending_users = pending_users, authorized_users = authorized_users, admin_users = admin_users)


@b_admin.route("/user/remove/<email>")
@login_required
@admin_required
def remove_user(email):
    if email is not None:
        db = open_session()
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            db.delete(user)
        close_session(db)
    return list_user()


@b_admin.route("/user/unauthorize/<email>")
@login_required
@admin_required
def unauthorize_user(email):
    if email is not None:
        db = open_session()
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.is_authorized = False
        close_session(db)
    return list_user()


@b_admin.route("/user/authorize/<email>")
@login_required
@admin_required
def authorize_user(email):
    if email is not None:
        db = open_session()
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.is_authorized = True
        close_session(db)
    return list_user()


@b_admin.route("/user/revoke/<email>")
@login_required
@admin_required
def revoke_user(email):
    if email is not None:
        db = open_session()
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.is_admin = False
        close_session(db)
    return list_user()


@b_admin.route("/user/promote/<email>")
@login_required
@admin_required
def promote_user(email):
    if email is not None:
        db = open_session()
        user = db.query(User).filter(User.email == email).first()
        if user is not None and user.is_authorized:
            user.is_admin = True
        close_session(db)
    return list_user()


# Worker management
@b_admin.route("/worker")
@b_admin.route("/worker/<error>")
@login_required
@admin_required
def list_worker(error=None):
    properties = [ "name", "ip", "port", "token" ]
    db = open_session()
    existing = []
    for w in db.query(Worker).all():
        existing.append({
            "name": w.name,
            "type": w.type,
            "ip": w.ip,
            "port": w.port,
            "token": w.token
        })
    close_session(db)
    # Display the type of the worker
    if error is None or len(error) == 0:
        return flask.render_template("admin.html", admin = current_user.is_admin, active_btn = "admin_worker", elem_type = "worker",
            props = properties, elements = existing)
    else:
        return flask.render_template("admin.html", admin = current_user.is_admin, active_btn = "admin_worker", elem_type = "worker",
            props = properties, elements = existing, msg = error)


@b_admin.route("/add/worker", methods=[ "POST" ])
@login_required
@admin_required
def add_worker():
    worker_ip = flask.request.form["ip"]
    worker_port = flask.request.form["port"]
    worker_token = flask.request.form["token"]
    worker_type = ""
    msg = ""
    try:
        # Test the connection to the worker
        r = requests.get(url = "http://%s:%s/v1/debug/status" % (worker_ip, worker_port))
        if r.status_code != 200 or "status" not in r.json():
            msg = "wrong answer from the worker '%s:%s'" % (worker_ip, worker_port)
        else:
            worker_type = r.json()["type"]
        # Test the authentication token
        r = requests.post(url = "http://%s:%s/v1/debug/auth" % (worker_ip, worker_port), json = { "token": worker_token })
        if r.status_code != 200 or "auth" not in r.json():
            msg = "wrong token for the worker '%s:%s'" % (worker_ip, worker_port)
        # Add the worker to my database
        if len(msg) == 0:
            db = open_session()
            new_worker = Worker()
            new_worker.name = flask.request.form["name"]
            new_worker.type = worker_type
            new_worker.ip = worker_ip
            new_worker.port = worker_port
            new_worker.token = worker_token
            db.add(new_worker)
            close_session(db)
    except:
        logging.exception("add worker failure")
        msg = "can not add the worker '%s:%s'" % (worker_ip, worker_port)
    return list_worker(msg)


@b_admin.route("/delete/worker/<worker_name>")
@login_required
@admin_required
def delete_worker(worker_name):
    if worker_name is not None:
        db = open_session()
        worker = db.query(Worker).filter(Worker.name == worker_name).first()
        if worker is not None:
            db.delete(worker)
        close_session(db)
    return list_worker()


# Other element management
@b_admin.route("/get/<el_type>")
@b_admin.route("/get/<el_type>/<error>")
@login_required
@admin_required
def get(el_type, error=None):
    properties = []
    existing = []
    worker_names = []
    worker_types = load_config()["%s_provider" % el_type]
    if worker_types is None or len(worker_types) == 0:
        error = "missing '%s_provider' property in the configuration file" % el_type
        return flask.render_template("admin.html", admin = current_user.is_admin, active_btn = "admin_%s" % el_type,
            workers = worker_names, elem_type = el_type, props = properties, elements = existing, msg = error)
    db = open_session()
    workers = db.query(Worker).filter(Worker.type.in_(worker_types)).all()
    for w in workers:
        # Send the worker names to the template
        worker_names.append(w.name)
        # Get the switch properties to register new switches
        r = requests.post(url = "http://%s:%s/v1/admin/add/%s" % (w.ip, w.port, el_type), json = { "token": w.token })
        if r.status_code != 200 or "missing" not in r.json():
            error = "property error from the worker '%s:%s'" % (w.ip, w.port)
        else:
            properties = r.json()["missing"]
        # Get the existing switches
        r = requests.post(url = "http://%s:%s/v1/user/%s" % (w.ip, w.port, el_type), json = { "token": w.token })
        if r.status_code != 200:
            error = "can not get the list of %ss from the worker '%s:%s'" % (el_type, w.ip, w.port)
        else:
            for sw in r.json():
                existing.append(r.json()[sw])
                existing[-1]["name"] = sw
                existing[-1]["worker"] = w.name
    close_session(db)
    # Get the existing switches
    if error is None or len(error) == 0:
        return flask.render_template("admin.html", admin = current_user.is_admin, active_btn = "admin_%s" % el_type,
            workers = worker_names, elem_type = el_type, props = properties, elements = existing)
    else:
        return flask.render_template("admin.html", admin = current_user.is_admin, active_btn = "admin_%s" % el_type,
            workers = worker_names, elem_type = el_type, props = properties, elements = existing, msg = error)


@b_admin.route("/add/<el_type>/", methods=[ "POST" ])
@login_required
@admin_required
def add(el_type):
    db = open_session()
    try:
        worker_name = flask.request.form["worker"]
        # Get the worker information
        worker = db.query(Worker).filter(Worker.name == worker_name).first()
        forbidden_props = [ "worker" ]
        json_args = {}
        for prop in flask.request.form:
            if prop not in forbidden_props:
                json_args[prop] = flask.request.form[prop]
        json_args["token"] = worker.token
        # Register the element to the worker
        r = requests.post(url = "http://%s:%s/v1/admin/add/%s" % (worker.ip, worker.port, el_type), json = json_args)
        if r.status_code != 200:
            msg = "can not add the %s '%s' to the worker '%s:%s'" % (el_type, flask.request.form["name"], worker.ip, worker.port)
        elif el_type not in r.json():
            msg = "wrong answer from '%s:%s' for the %s '%s'"% (worker.ip, worker.port, el_type, flask.request.form["name"])
        else:
            msg = ""
    except:
        logging.exception("add worker failure")
        msg = "wrong %s configuration for '%s'" % (el_type, json_args["name"])
    close_session(db)
    return get(el_type, msg)


@b_admin.route("/delete/<el_type>/<worker_name>/<el_name>")
@login_required
@admin_required
def delete(el_type, worker_name, el_name):
    # Get the worker information
    db = open_session()
    worker = db.query(Worker).filter(Worker.name == worker_name).first()
    json_args = { "token": worker.token, "name": el_name }
    worker_ip = worker.ip
    worker_port = worker.port
    close_session(db)
    msg = ""
    try:
        # Delete the element to the worker
        r = requests.post(url = "http://%s:%s/v1/admin/delete/%s" % (worker_ip, worker_port, el_type), json = json_args)
        if r.status_code != 200:
            msg = "can not delete the %s '%s' to the worker '%s:%s'" % (el_type, el_name, worker_ip, worker_port)
        elif "delete" not in r.json():
            msg = "wrong answer while deleting the %s '%s'" % (el_type, el_name)
    except:
        logging.exception("delete element failure")
        msg = "can not delete the %s '%s'" % (el_type, el_name)
    return get(el_type, msg)


