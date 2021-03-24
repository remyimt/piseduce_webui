from api.tool import sort_by_name
from database.connector import open_session, close_session
from database.tables import User, Worker
from flask_login import current_user, login_required
from lib.config_loader import load_config
from werkzeug.security import generate_password_hash
import flask, json, logging, requests


b_user = flask.Blueprint("user", __name__, template_folder="templates/")


# REST API to connect the web UI and the workers
@b_user.route("/node/list")
@login_required
def node_list():
    result = { "errors": [], "nodes": {} }
    db = open_session()
    for worker in db.query(Worker).all():
        r = requests.post(url = "http://%s:%s/v1/user/node/prop" % (worker.ip, worker.port),
            json = { "token": worker.token })
        if r.status_code == 200:
            r_json = r.json()
            duplicated_names = []
            for node in r_json:
                if node in result["nodes"]:
                    duplicated_names.append(node)
                else:
                    result["nodes"][node] = r_json[node]
            if len(duplicated_names) > 0:
                result["errors"].append("on worker '%s', duplicated names: %s" % (worker.name, duplicated_names))
        else:
            result["errors"].append("on worker '%s', connection error with return code %d" % (worker.name, r.status_code))
    if len(result["errors"]) == 0:
        result["nodes"] = sort_by_name(result["nodes"])
    close_session(db)
    return json.dumps(result)


@b_user.route("/node/configuring")
@login_required
def node_configuring():
    result = { "errors": [], "raspberry": {}, "sensor": {}, "server": {}, "fake": {} }
    db = open_session()
    for worker in db.query(Worker).all():
        r = requests.post(url = "http://%s:%s/v1/user/configure" % (worker.ip, worker.port),
            json = { "token": worker.token, "user": current_user.email })
        if r.status_code == 200 and worker.type in result:
            # Add the worker name to the node information
            json_data = r.json()
            for node in json_data:
                json_data[node]["worker"] = worker.name
            result[worker.type].update(json_data)
        else:
            logging.error("configuring error: wrong answer from the worker '%s'" % worker.name)
    close_session(db)
    for node_type in result:
        if node_type != "errors":
            result[node_type] = sort_by_name(result[node_type])
    return json.dumps(result)


@b_user.route("/node/deploying")
@login_required
def node_deploying():
    result = { "errors": {} }
    db = open_session()
    for worker in db.query(Worker).all():
        r = requests.post(url = "http://%s:%s/v1/user/node/mine" % (worker.ip, worker.port),
            json = { "token": worker.token, "user": current_user.email })
        if r.status_code == 200:
            # Add the worker name to the node information
            json_data = r.json()
            for node in json_data:
                bin_name = json_data[node].pop("bin")
                del json_data[node]["type"]
                json_data[node]["worker"] = worker.name
                # No bin for nodes in 'configuring' state
                if len(bin_name) > 0:
                    # Sort nodes by bin name
                    if bin_name not in result:
                        result[bin_name] = { "raspberry": [], "sensor": [], "server": [], "fake": [] }
                    result[bin_name][worker.type].append(json_data[node])
        else:
            logging.error("deploying error: wrong answer from the worker '%s'" % worker.name)
            result["errors"][worker.name] = "connection error - return code %d" % r.status_code
    close_session(db)
    return json.dumps(result)


@b_user.route("/node/updating")
@login_required
def node_updating():
    result = { "errors": {} }
    db = open_session()
    for worker in db.query(Worker).all():
        r = requests.post(url = "http://%s:%s/v1/user/node/status" % (worker.ip, worker.port),
            json = { "token": worker.token, "user": current_user.email })
        if r.status_code == 200:
            json_data = r.json()
            for node in json_data:
                bin_name = json_data[node].pop("bin")
                # No bin for nodes in 'configuring' state
                if len(bin_name) > 0:
                    # Sort nodes by bin name
                    if bin_name not in result:
                        result[bin_name] = { "raspberry": [], "sensor": [], "server": [], "fake": [] }
                    result[bin_name][worker.type].append(json_data[node])
    close_session(db)
    return json.dumps(result)


@b_user.route("/make/reserve", methods=["POST"])
@login_required
def make_reserve():
    result = { "nodes": [], "errors": [] }
    msg = ""
    db = open_session()
    for prop in flask.request.json:
        matching_nodes = []
        available_nodes = []
        nb_nodes = int(prop["nb_nodes"])
        worker_type = prop["type"]
        del prop["nb_nodes"]
        del prop["type"]
        if worker_type is not None and len(worker_type) > 0:
            for worker in db.query(Worker).filter(Worker.type == worker_type).all():
                # Get the nodes with at least one of requested properties
                r = requests.post(url = "http://%s:%s/v1/user/node/list" % (worker.ip, worker.port),
                    json = { "token": worker.token, "properties": prop })
                if r.status_code == 200:
                    r_json = r.json()
                    for node, node_props in r_json.items():
                        # Check the node have all requested properties
                        if len(prop) == 0 or len(prop) == len(node_props):
                            matching_nodes.append(node)
                else:
                    logging.error("node reservation failure: can not get the node list from the worker '%s'" % worker.name)
                logging.info("Macthing nodes: %s" % matching_nodes)
                # Check the status of the nodes (we only want 'available' nodes)
                if len(matching_nodes) > 0:
                    r = requests.post(url = "http://%s:%s/v1/user/node/status" % (worker.ip, worker.port),
                        json = { "token": worker.token, "nodes": matching_nodes })
                    if r.status_code == 200:
                        for node, props in r.json().items():
                            if props["status"] == "available" and len(available_nodes) < nb_nodes:
                                available_nodes.append(node)
                    else:
                        logging.error("node reservation failure: can not get the node status from the worker '%s'" % worker.name)
                # Make the reservation
                if len(available_nodes) > 0:
                    r = requests.post(url = "http://%s:%s/v1/user/reserve" % (worker.ip, worker.port),
                            json = { "token": worker.token, "nodes": available_nodes, "user": current_user.email })
                    if r.status_code == 200:
                        result["nodes"] += available_nodes
                    else:
                        logging.error("can not reserve nodes: wrong return code %d from '%s'" % (
                            r.status_code, worker.name))
                        result["errors"] += available_nodes
                else:
                    logging.error("No available node. Matching nodes: %s" % matching_nodes);
                    result["errors"] += "No available node"
        else:
            logging.error("node reservation failure: no 'type' property in the JSON content")
    close_session(db)
    return json.dumps(result)


@b_user.route("/make/deploy", methods=["POST"])
@login_required
def make_deploy():
    form_data = flask.request.form
    dep_name = None
    duration = None
    result = {}
    json_result = { "errors": []}
    for prop in form_data:
        if prop == "bin":
            bin_name = form_data[prop]
        elif prop == "duration":
            duration = form_data[prop]
        else:
            node_name, _, prop_name = prop.rpartition("-")
            if prop_name == "worker":
                last_worker = form_data[prop]
                if last_worker not in result:
                    result[last_worker] = {}
                result[last_worker][node_name] = { "node_bin": bin_name, "duration": duration }
            else:
                result[last_worker][node_name][prop_name] = form_data[prop]
    if len(result) == 0:
        return flask.redirect("/user/configure?msg=%s" % "No data available to deploy nodes")
    db = open_session()
    for worker_name in result:
        worker = db.query(Worker).filter(Worker.name == worker_name).first()
        r = requests.post(url = "http://%s:%s/v1/user/deploy" % (worker.ip, worker.port),
                json = { "token": worker.token, "nodes": result[worker_name], "user": current_user.email })
        if r.status_code == 200:
            json_result.update(r.json())
        else:
            json_result["errors"].append("wrong answer from the worker '%s'" % worker_name)
    close_session(db)
    if len(json_result["errors"]) > 0:
        return flask.redirect("/user/configure?msg=%s" % ",".join(json_result["errors"]))
    else:
        return flask.redirect("/user/manage")
    return json.dumps(json_result)


@b_user.route("/make/exec", methods=["POST"])
@login_required
def make_exec():
    result = {"errors": [] }
    json_data = flask.request.json
    # Use the function 'init_action_process' of worker_exec
    if "nodes" in json_data and "reconfiguration" in json_data:
        db = open_session()
        for worker_name in json_data["nodes"]:
            worker = db.query(Worker).filter(Worker.name == worker_name).first()
            r = requests.post(url = "http://%s:%s/v1/user/%s" % (worker.ip, worker.port, json_data["reconfiguration"]),
                    json = { "token": worker.token, "nodes": json_data["nodes"][worker_name], "user": current_user.email })
            if r.status_code == 200:
                json_answer = r.json();
                failure = []
                for node in json_answer:
                    if json_answer[node] != "success":
                        failure.append(node)
                if len(failure) > 0:
                    result["errors"].append("nodes with failure: %s" % failure)
                else:
                    result.update(json_answer)
            else:
                logging.error("reconfiguration failure: the worker '%s' fails to execute '%s'" % (
                    worker_name, json_data["reconfiguration"]))
                result["errors"].append("wrong answer from the worker '%s'" % worker_name)
        close_session(db)
    return json.dumps(result)


@b_user.route("/settings/password", methods=["POST"])
@login_required
def user_pwd():
    msg = ""
    form_data = flask.request.form
    db = open_session()
    user = db.query(User).filter(User.email == current_user.email).first()
    if "password" in form_data and "confirm_password" in form_data:
        if form_data["password"] == form_data["confirm_password"]:
            user.password = generate_password_hash(form_data["password"], method="sha256")
            msg = "Password updated!"
        else:
            msg = "The two passwords are different. Password unchanged!"
    else:
        msg = "Missing data in the request. Password unchanged!"
    close_session(db)
    return flask.redirect("/user/settings?msg=" + msg)


@b_user.route("/settings/ssh", methods=["POST"])
@login_required
def user_ssh():
    msg = ""
    form_data = flask.request.form
    db = open_session()
    user = db.query(User).filter(User.email == current_user.email).first()
    if "ssh_key" in form_data:
        user.ssh_key = form_data["ssh_key"]
        msg = "SSH key updated!"
    else:
        msg = "Missing data in the request. SSH key unchanged!"
    close_session(db)
    return flask.redirect("/user/settings?msg=" + msg)


# HTML Pages
@b_user.route("/reserve")
@login_required
def reserve():
    return flask.render_template("reserve.html", admin = current_user.is_admin, active_btn = "user_reserve",
        nodes = json.loads(node_list())["nodes"],
        webui_str = "%s:%s" % (load_config()["ip"], load_config()["port_number"]))


@b_user.route("/configure")
@login_required
def configure():
    return flask.render_template("configure.html", admin = current_user.is_admin, active_btn = "user_configure",
        nodes = json.loads(node_configuring()),
        webui_str = "%s:%s" % (load_config()["ip"], load_config()["port_number"]))


@b_user.route("/manage")
@login_required
def manage():
    return flask.render_template("manage.html", admin = current_user.is_admin, active_btn = "user_manage",
        nodes = json.loads(node_deploying()),
        webui_str = "%s:%s" % (load_config()["ip"], load_config()["port_number"]))


@b_user.route("/settings")
@login_required
def settings():
    result = {}
    db = open_session()
    user = db.query(User).filter(User.email == current_user.email).first()
    if user is not None:
        status = "User"
        if user.is_admin:
            status = "Admin"
        ssh_key = ""
        if user.ssh_key is not None:
            ssh_key = user.ssh_key
        result = { "email": user.email, "ssh_key": ssh_key, "status": status }
    close_session(db)
    return flask.render_template("settings.html", admin = current_user.is_admin, active_btn = "user_settings",
        user = result,
        webui_str = "%s:%s" % (load_config()["ip"], load_config()["port_number"]))
