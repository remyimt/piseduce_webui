## PiSeduce Agent Configuration

### SystemD Service Install
The piseduce agent consists of two systemD services: *agent_api* and *agent_exec*.
The *agent_api* service is a REST API used to communicate with *piseduce_webui*.
The *agent_exec* service deploys the nodes reserved by users.
The systemD files of these services are in `piseduce_agent/admin/`. Install them with:
```
cp admin/*.service /etc/systemd/system/
systemctl enable agent_api
systemctl enable agent_exec
```

### Create the database
* If the database does not exist, you must create it before starting the agent services:
```
python3 init_database.py config_agent.json
```

### Start the piseduce agent
* From the systemD service
```
service agent_api start
service agent_exec start
```
* From the command line
```
python3 agent_api.py config_agent.json
python3 agent_exec.py config_agent.json
```

### Configuration file
The configuration file is `config_agent.json`:
* `auth_token`: the authentication token to communicate with the agent. This token must be given to the *piseduce_webui*.
* `port_number`: the port number used by the *agent_api*. This number must be given to the *piseduce_webui*.
* `ip`: (optional) if the *agent_exec* does not find the agent IP, you can set it with this property.
* `node_type`: the type of the nodes managed by the agent. This properties determines the `states.py` and the `action_exec.py` that
  will be loaded. For example, if `node_type` is equal to `raspberry`, `raspberry/states.py` and `raspberry/action_exec.py` will be
  used to configure the raspberry nodes.
* `db_url`: the link used for the database connection (*mysql* or *sqlite*).
* `env_path`: the path to the directory containing the environment images.
* `client_prop`: the required properties to add a DHCP client in the dnsmasq server (DHCP server)
* `switch_prop`: the required properties to add a switch to the agent database.
* `env_prop`: the required properties to add an environment to the agent database.
* `node_prop`: the required properties to add a node to the agent database.
* `fake_prop`: the required properties to add a fake node to the agent database.
* `raspberry_prop`: the required properties to add a raspberry to the agent database.
* `configure_prop`: the required properties to configure a node in the *configuring* state.
  These properties are used to build the forms of the configure page of the *piseduce_webui* interface.
* **NOTE**: In most cases, only the `node_type` needs to be specified. The default node type is *raspberry*.
  Otherwise, this configuration file can be used without modification.
  The *piseduce_webui* administrator needs to know the `auth_token`, the `port_number` and the IP of the agent to connect it.
