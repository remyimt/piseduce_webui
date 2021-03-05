from database.connector import open_session, close_session
from database.tables import Worker
from flask_login import current_user, login_required
import flask, json, logging, requests


b_user = flask.Blueprint("user", __name__, template_folder="templates/")


# REST API to connect the web UI and the workers
@b_user.route("/node/list")
@login_required
def node_list():
    result = { "nodes": {}, "errors": {} }
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
                result["errors"][worker.name] = "duplicated names: %s" % duplicated_names
        else:
            result["errors"][worker.name] = "connection error - return code %d" % r.status_code
    close_session(db)
    return json.dumps(result)


@b_user.route("/node/configuring")
@login_required
def node_configuring():
    result = { "raspberry": {}, "sensor": {}, "server": {}, "fake": {} }
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
    return json.dumps(result)


@b_user.route("/node/deploying")
@login_required
def node_deploying():
    result = { "nodes": {}, "errors": {} }
    db = open_session()
    for worker in db.query(Worker).all():
        r = requests.post(url = "http://%s:%s/v1/user/node/mine" % (worker.ip, worker.port),
            json = { "token": worker.token, "user": current_user.email })
        if r.status_code == 200:
            result["nodes"].update(r.json())
        else:
            logging.error("deploying error: wrong answer from the worker '%s'" % worker.name)
            result["errors"][worker.name] = "connection error - return code %d" % r.status_code
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
    print(form_data)
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


# HTML Pages
@b_user.route("/reserve")
@login_required
def reserve():
    return flask.render_template("reserve.html", admin = current_user.is_admin, active_btn = "user_reserve",
        nodes = json.loads(node_list())["nodes"])


@b_user.route("/configure")
@login_required
def configure():
    return flask.render_template("configure.html", admin = current_user.is_admin, active_btn = "user_configure",
        nodes = json.loads(node_configuring()))


@b_user.route("/manage")
@login_required
def manage():
    print(node_deploying())
    return flask.render_template("manage.html", admin = current_user.is_admin, active_btn = "user_manage",
        nodes = json.loads(node_deploying())["nodes"])
