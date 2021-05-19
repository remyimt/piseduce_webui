## PiSeduce Webui Configuration
The piseduce webui is a web application. You can connect to it with a web client, for example, Firefox!
The *webui* service is a REST API and a web application. The REST API is used by the Javascript scripts to
talk with the web application.  
After the first install of the webui, you can connect with the login `admin@piseduce.fr` and the password `piseduceadmin`.

### SystemD Service Install
The systemD file of the *webui* service is in `piseduce_webui/admin/`. Install it with:
```
cp admin/*.service /etc/systemd/system/
systemctl enable webui
```

### Create the database
* If the database does not exist, you must create it before starting the webui service:
```
python3 init_database.py config_agent.json
```

### Start the piseduce agent
* From the systemD service
```
service webui start
```
* From the command line
```
python3 webui.py
```

### Configuration file
The configuration file is `config_webui.json`:
* `port_number`: the port number used by the *webui*. You can connect to: *http://webui_ip:port_number*.
* `pwd_secret_key`: the secret key used to encrypt user passwords (probably unused).
* `db_url`: the link used for the database connection (*mysql* or *sqlite*).
* `node_provider`: the list of the agent types allowed to provide nodes (the default value should be [ "raspberry", "sensor", "server" ]).
  The agent type is defined by the `node_type` property of the *piseduce_agent* configuration file.
* `switch_provider`: the list of the agent types allowed to provide switches (the default value should be [ "raspberry" ]).
* `client_provider`: the list of the agent types allowed to provide DHCP clients (the default value should be [ "raspberry" ]).
* `environment_provider`: the list of the agent types allowed to provide node environment (the default value should be [ "raspberry" ]).
* **NOTE**: In most cases, this configuration file can be used without modification.

