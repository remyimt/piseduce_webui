from api.tool import sort_by_name
from database.connector import open_session, close_session
from database.tables import User, Agent
from flask_login import current_user, login_required
from requests.exceptions import ConnectTimeout, ConnectionError
from werkzeug.security import generate_password_hash
import flask, json, logging, os, requests


b_user = flask.Blueprint("user", __name__, template_folder="templates/")
POST_TIMEOUT = 30


# REST API to connect the web UI and the agents
@b_user.route("/node/list")
@login_required
def node_list():
    result = { "errors": [], "nodes": {}, "duplicated": [] }
    db = open_session()
    for agent in db.query(Agent).filter(Agent.state == "connected").all():
        try:
            r = requests.post(url = "http://%s:%s/v1/user/node/list" % (agent.ip, agent.port),
                timeout = POST_TIMEOUT,
                json = { "token": agent.token })
            if r.status_code == 200:
                r_json = r.json()
                duplicated_names = []
                for node in r_json:
                    if node in result["nodes"]:
                        duplicated_names.append(node)
                    else:
                        node_info = r_json[node]
                        node_info["type"] = agent.type
                        node_info["agent"] = agent.name
                        result["nodes"][node] = node_info
                if len(duplicated_names) > 0:
                    result["duplicated"] += duplicated_names
                    error_msg = "on agent '%s', duplicated names: %s" % (agent.name, duplicated_names)
                    result["errors"].append(error_msg)
                    logging.error(error_msg)
            else:
                error_msg = "on agent '%s', connection error with return code %d" % (agent.name, r.status_code)
                result["errors"].append(error_msg)
                logging.error(error_msg)
        except (ConnectionError, ConnectTimeout):
            agent.state = "disconnected"
            error_msg = "agent '%s' does not respond" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
        except Exception as e:
            error_msg = "connection failure to the agent '%s'" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
    close_session(db)
    if len(result["errors"]) == 0:
        result["nodes"] = sort_by_name(result["nodes"])
    return json.dumps(result)


@b_user.route("/node/schedule")
@login_required
def node_schedule():
    result = { "errors": [], "nodes": {} }
    db = open_session()
    for agent in db.query(Agent).filter(Agent.state == "connected").all():
        try:
            r = requests.post(url = "http://%s:%s/v1/user/node/schedule" % (agent.ip, agent.port),
                timeout = POST_TIMEOUT,
                json = { "token": agent.token, "user": current_user.email })
            if r.status_code == 200:
                r_json = r.json()
                result["nodes"].update(r_json["nodes"])
            else:
                logging.error("schedule error: wrong answer from the agent '%s'" % agent.name)
        except (ConnectionError, ConnectTimeout):
            error_msg = "agent '%s' does not respond" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
        except:
            error_msg = "connection failure to the agent '%s'" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
    close_session(db)
    return json.dumps(result)


@b_user.route("/node/configuring")
@login_required
def node_configuring():
    result = { "errors": [], "raspberry": {}, "iot-lab": {}, "g5k": {} }
    db = open_session()
    for agent in db.query(Agent).filter(Agent.state == "connected").all():
        try:
            r = requests.post(url = "http://%s:%s/v1/user/configure" % (agent.ip, agent.port),
                timeout = POST_TIMEOUT,
                json = { "token": agent.token, "user": current_user.email })
            if r.status_code == 200 and agent.type in result:
                # Add the agent name to the node information
                json_data = r.json()
                for node in json_data:
                    json_data[node]["agent"] = agent.name
                result[agent.type].update(json_data)
            else:
                logging.error("configuring error: wrong answer from the agent '%s'" % agent.name)
        except (ConnectionError, ConnectTimeout):
            agent.state = "disconnected"
            error_msg = "agent '%s' does not respond" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
        except:
            error_msg = "connection failure to the agent '%s'" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
    close_session(db)
    for node_type in result:
        if node_type != "errors":
            result[node_type] = sort_by_name(result[node_type])
    return json.dumps(result)


@b_user.route("/node/deploying")
@login_required
def node_deploying():
    result = { "errors": [], "nodes": {}, "states": [] }
    db = open_session()
    for agent in db.query(Agent).filter(Agent.state == "connected").all():
        try:
            r = requests.post(url = "http://%s:%s/v1/user/node/mine" % (agent.ip, agent.port),
                timeout = POST_TIMEOUT,
                json = { "token": agent.token, "user": current_user.email })
            if r.status_code == 200:
                json_data = r.json()
                result["states"] = { "raspberry": [], "iot-lab": [], "g5k": [] }
                result["states"][agent.type] = json_data["states"]
                for node in json_data["nodes"]:
                    # Sort the nodes by bin
                    bin_name = json_data["nodes"][node].pop("bin")
                    # Add the agent name to the node information
                    json_data["nodes"][node]["agent"] = agent.name
                    # No bin for nodes in 'configuring' state
                    if len(bin_name) > 0:
                        # Sort nodes by bin name
                        if bin_name not in result["nodes"]:
                            result["nodes"][bin_name] = { "raspberry": [], "iot-lab": [], "g5k": [] }
                        result["nodes"][bin_name][agent.type].append(json_data["nodes"][node])
            else:
                error_msg = "deploying error: wrong answer from the agent '%s' (return code %d)" % (
                    agent.name, r.status_code)
                logging.error(error_msg)
                result["errors"].append(error_msg)
        except (ConnectionError, ConnectTimeout):
            agent.state = "disconnected"
            error_msg = "agent '%s' does not respond" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
        except:
            error_msg = "connection failure to the agent '%s'" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
    close_session(db)
    return json.dumps(result)


@b_user.route("/node/updating")
@login_required
def node_updating():
    result = { "errors": [] }
    db = open_session()
    for agent in db.query(Agent).filter(Agent.state == "connected").all():
        try:
            r = requests.post(url = "http://%s:%s/v1/user/node/state" % (agent.ip, agent.port),
                timeout = POST_TIMEOUT,
                json = { "token": agent.token, "user": current_user.email })
            if r.status_code == 200:
                json_data = r.json()
                for node in json_data["nodes"]:
                    bin_name = json_data["nodes"][node].pop("bin")
                    # No bin for nodes in 'configuring' state
                    if len(bin_name) > 0:
                        # Sort nodes by bin name
                        if bin_name not in result:
                            result[bin_name] = { "raspberry": [], "iot-lab": [], "g5k": [] }
                        result[bin_name][agent.type].append(json_data["nodes"][node])
        except:
            error_msg = "connection failure to the agent '%s'" %  agent.name
            result["errors"].append(error_msg)
            logging.exception(error_msg)
    close_session(db)
    return json.dumps(result)


@b_user.route("/make/reserve", methods=["POST"])
@login_required
def make_reserve():
    result = { "total_nodes": 0, "wanted": 0, "errors": [] }
    nb_wanted = 0
    msg = ""
    db = open_session()
    for f in flask.request.json["filters"]:
        result["wanted"] += f["nb_nodes"]
        if "agent" in f:
            agent = db.query(Agent).filter(Agent.name == f["agent"]).filter(Agent.state == "connected").first()
            if agent is not None:
                # Make the reservation
                r = requests.post(url = "http://%s:%s/v1/user/reserve" % (agent.ip, agent.port),
                    timeout = POST_TIMEOUT,
                    json = {
                        "token": agent.token, "filter": f, "user": current_user.email,
                        "start_date": flask.request.json["start_date"],
                        "duration": flask.request.json["duration"]
                    })
                if r.status_code == 200:
                    r_json = r.json()
                    if "nodes" in r_json:
                        result["total_nodes"] += len(r.json()["nodes"])
                    if "error" in r_json:
                        result["errors"].append(r_json["error"])
                else:
                    logging.error("can not reserve nodes: wrong return code %d from '%s'" % (r.status_code, agent.name))
            else:
                logging.error("can not find the agent '%s' (maybe it is disconnected)" % f["agent"])
        elif "type" in f:
            agent_type = f["type"]
            del f["type"]
            for agent in db.query(Agent).filter(Agent.type == agent_type).filter(Agent.state == "connected").all():
                if f["nb_nodes"] > 0:
                    # Make the reservation
                    r = requests.post(url = "http://%s:%s/v1/user/reserve" % (agent.ip, agent.port),
                        timeout = POST_TIMEOUT,
                        json = {
                            "token": agent.token, "filter": f, "user": current_user.email,
                            "start_date": flask.request.json["start_date"],
                            "duration": flask.request.json["duration"]
                        })
                    if r.status_code == 200:
                        nb_nodes = len(r.json()["nodes"])
                        result["total_nodes"] += nb_nodes
                        f["nb_nodes"] -= nb_nodes
                    else:
                        logging.error("can not reserve nodes: wrong return code %d from '%s'" % (r.status_code, agent.name))
        else:
            logging.error("node reservation failure: no 'type' property and no 'agent' property in the POST data")
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
        else:
            node_name, _, prop_name = prop.rpartition("-")
            if prop_name == "agent":
                last_agent = form_data[prop]
                if last_agent not in result:
                    result[last_agent] = {}
                result[last_agent][node_name] = { "node_bin": bin_name }
            else:
                result[last_agent][node_name][prop_name] = form_data[prop]
    if len(result) == 0:
        return flask.redirect("/user/configure?msg=%s" % "No data available to deploy nodes")
    db = open_session()
    for agent_name in result:
        # Send the user SSH key to the agent
        user_db = db.query(User).filter(User.email == current_user.email).first()
        if user_db.ssh_key is not None and len(user_db.ssh_key) > 256:
            for node in result[agent_name]:
                result[agent_name][node]["account_ssh_key"] = user_db.ssh_key
        agent = db.query(Agent).filter(Agent.name == agent_name).first()
        r = requests.post(url = "http://%s:%s/v1/user/deploy" % (agent.ip, agent.port),
            timeout = POST_TIMEOUT,
            json = { "token": agent.token, "nodes": result[agent_name], "user": current_user.email })
        if r.status_code == 200:
            json_result.update(r.json())
        else:
            json_result["errors"].append("wrong answer from the agent '%s'" % agent_name)
    close_session(db)
    if len(json_result["errors"]) > 0:
        return flask.redirect("/user/configure?msg=%s" % ",".join(json_result["errors"]))
    else:
        return flask.redirect("/user/manage")
    return json.dumps(json_result)


@b_user.route("/make/exec", methods=["POST"])
@login_required
def make_exec():
    result = { "errors": [] }
    json_data = flask.request.json
    # Use the function 'init_action_process' of agent_exec
    if "nodes" in json_data and "reconfiguration" in json_data:
        db = open_session()
        for agent_name in json_data["nodes"]:
            agent = db.query(Agent).filter(Agent.name == agent_name).first()
            r = requests.post(url = "http://%s:%s/v1/user/%s" % (agent.ip, agent.port, json_data["reconfiguration"]),
                timeout = POST_TIMEOUT,
                json = { "token": agent.token, "nodes": json_data["nodes"][agent_name], "user": current_user.email })
            if r.status_code == 200:
                json_answer = r.json()
                if "error" in json_answer:
                    result["errors"].append(json_answer["error"])
                else:
                    failure = []
                    for node in json_answer:
                        if json_answer[node] != "success":
                            failure.append(node)
                    if len(failure) > 0:
                        result["errors"].append("nodes with failure: %s" % failure)
                    else:
                        result.update(json_answer)
            else:
                logging.error("reconfiguration failure: the agent '%s' fails to execute '%s'" % (
                    agent_name, json_data["reconfiguration"]))
                result["errors"].append("wrong answer from the agent '%s'" % agent_name)
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
    result = json.loads(node_list())
    return flask.render_template("reserve.html", admin = current_user.is_admin, active_btn = "user_reserve",
        nodes = result["nodes"], duplicated = result["duplicated"])


@b_user.route("/configure")
@login_required
def configure():
    return flask.render_template("configure.html", admin = current_user.is_admin, active_btn = "user_configure",
        nodes = json.loads(node_configuring()))


@b_user.route("/manage")
@login_required
def manage():
    json_data = json.loads(node_deploying())
    return flask.render_template("manage.html", admin = current_user.is_admin, active_btn = "user_manage",
        nodes = json_data["nodes"], states = json_data["states"], errors = json_data["errors"])


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
        if os.path.isfile("vpn_keys/%s.conf" % current_user.email.replace("@", "_")):
            result = { "email": user.email, "ssh_key": ssh_key, "status": status, "vpn_key": True }
        else:
            result = { "email": user.email, "ssh_key": ssh_key, "status": status, "vpn_key": False }
    close_session(db)
    return flask.render_template("settings.html", admin = current_user.is_admin, active_btn = "user_settings",
        user = result)


@b_user.route("/vpn/download/<vpn_key>")
@login_required
def vpn_download(vpn_key):
    if current_user.is_admin or current_user.email.replace("@", "_") == vpn_key:
        return flask.send_file("vpn_keys/%s.conf" % vpn_key, as_attachment = True)

