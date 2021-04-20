// When loading the admin switch page, get the nodes connected to the switches
$(document).ready(function () {
    var agentSelector = $("#agent-selector");
    if(agentSelector && Object.keys(agentSelector).length > 0) {
        // The element type is not agent
        agentSelect(agentSelector);
    } else {
        // The element type is agent, show the div
        $("#agent_key-add").show();
        $("#agent_key-existing").show();
    }
});

// Functions
function agentSelect(select) {
    $(".agent-div").hide();
    $("#" + $(select).val() + "-add").show()
    $("#" + $(select).val() + "-existing").show()
    $("#" + $(select).val() + "-switch").show()
    var switchSelector = $("#" + $(select).val() + "-switch-list");
    if(switchSelector && Object.keys(switchSelector).length > 0) {
        displayTable(switchSelector);
    }
}

// switchInfo = agentName + "-" + switchName
function updateSwitchNodes(switchInfo) {
    if(switchInfo != "-") {
        $("#" + switchInfo).show()
        var switchAgent = switchInfo.split("-")[0];
        var switchName = switchInfo.split("-")[1];
        $.ajax({
            type: "POST",
            url: WEBUI + "/admin/switch/" + switchAgent + "/" + switchName + "/nodes",
            dataType: 'json',
            contentType: 'application/json',
            async: false,
            success: function (data) {
                $("#" + switchName + "-table").find(".col").each(function(idx, col) {
                    var idx_str = String(idx + 1);
                    if(idx_str in data["nodes"]) {
                        $(col).children("div").html(idx_str + ": " + data["nodes"][idx_str]);
                    }
                });
            },
            error: function () {
                alert("Error: can not send the request");
            },
        });
    }
}

function displayTable(select) {
    $(".switch-table").hide();
    updateSwitchNodes($(select).val());
}

function hourString(str) {
    str = String(str);
    if(str.length < 2) {
        return "0" + str;
    } else {
        return str;
    }
}

function switchMessage(msg, colorClass = "") {
    var now = new Date();
    if(colorClass.length == 0) {
        $(".switch-console").prepend("<span><b class='text-info'>" +
            hourString(now.getHours()) + ":" + hourString(now.getMinutes()) + ":" + hourString(now.getSeconds()) +
            "</b> " + msg + "</span><br/>");
    } else {
        $(".switch-console").prepend("<span class='" + colorClass + "'><b class='text-info'>" +
            hourString(now.getHours()) + ":" + hourString(now.getMinutes()) + ":" + hourString(now.getSeconds()) +
            "</b> " + msg + "</span><br/>");
    }
}

function reconfigure(switchName) {
    var agent = $("#" + switchName + "-agent").val();
    var ports = [];
    var conf_name = $("#" + switchName + "-actions").val();
    $("#" + switchName + "-table").find("input:checked").each(function(useless, port_str) {
        ports.push($(port_str).attr("name").split("-")[1]);
        $(port_str).prop("checked", false);
    });
    if(conf_name == "port_status" || ports.length > 0) {
        switch(conf_name) {
            case "detect_nodes":
                initDetect(agent, switchName, ports);
                break;
            case "port_status":
                $.get(WEBUI + "/admin/switch/" + agent + "/" + switchName, function(data) {
                    var data = JSON.parse(data);
                    $("#" + switchName + "-table").find(".col").each(function(idx, port) {
                        $(port).attr("class", "col port-node " + data[switchName][idx]);
                    });
                });
                break;
            case "turn_off":
                turnOff(agent, switchName, ports);
                break;
            case "turn_on":
                turnOn(agent, switchName, ports);
                break;
        }
    } else {
        alert("No selected ports. Please select ports by ticking the checkboxes");
    }
}

function turnOff(agent, switchName, ports) {
    $.ajax({
        type: "POST",
        url: WEBUI + "/admin/switch/" + agent + "/" + switchName + "/turn_off",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify({"ports": ports}),
        success: function (data) {
            $("#" + switchName + "-table").find(".col").each(function(idx, port) {
                if(ports.includes(String(idx + 1))) {
                    $(port).attr("class", "col port-node off");
                }
            });
            if(data["errors"].length > 0) {
                alert(data["errors"]);
            }
        },
        error: function () {
            alert("Error: can not send the request");
        },
    });
}

function turnOn(agent, switchName, ports) {
    $.ajax({
        type: "POST",
        url: WEBUI + "/admin/switch/" + agent + "/" + switchName + "/turn_on",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify({"ports": ports}),
        success: function (data) {
            $("#" + switchName + "-table").find(".col").each(function(idx, port) {
                if(ports.includes(String(idx + 1))) {
                    $(port).attr("class", "col port-node on");
                }
            });
        },
        error: function () {
            alert("Error: can not send the request");
        },
    });
}

// Functions for the detect_nodes action
function initDetect(agent, switchName, ports) {
    $(".switch-console").empty();
    $(".switch-console").show();
    switchMessage("Preparing the NFS boot for nodes on ports " + ports);
    $.ajax({
        type: "POST",
        url: WEBUI + "/admin/switch/" + agent + "/" + switchName + "/init_detect",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify( {"ports": ports} ),
        success: function (data) {
            if(data["errors"].length > 0) {
                for(error of data["errors"]) {
                    if(error.includes("DHCP configuration")) {
                        error = error + " <a href=\"javascript:deleteDHCPRule('" + switchName + "', '" +
                            error.split(" ")[0] + "')\">Update the DHCP configuration</a> to delete " +
                            error.split(" ")[0] + ".";
                    }
                    switchMessage(error, "text-danger");
                }
            } else {
                switchMessage("Turn off nodes on the selected ports");
                turnOff(agent, switchName, ports);
                bootNode(agent, switchName, ports, 0, data["macs"], data["network"], data["ip_offset"]);
            }
        },
        error: function () {
            alert("Error: can not send the request");
        },
    });
}

function deleteDHCPRule(switchName, ip_mac) {
    var ip = "";
    var mac = "";
    var agent = $("#" + switchName + "-agent").val();
    if(ip_mac.includes(":")) {
        mac = ip_mac;
    } else {
        ip = ip_mac;
    }
    $.ajax({
        type: "POST",
        url: WEBUI + "/admin/switch/" + agent + "/" + switchName + "/dhcp_conf/del",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify({"ip": ip, "mac": mac}),
        success: function (data) {
            switchMessage("DHCP configuration updated", "text-success");
        },
        error: function () {
            alert("Error: can not send the request");
        },
    });
}

function bootNode(agent, switchName, ports, portIdx, existingMACs, network, ipOffset) {
    switchMessage("Turn on the node on port " + ports[portIdx], "text-warning");
    turnOn(agent, switchName, [ ports[portIdx] ]);
    switchMessage("The node on port " + ports[portIdx] + " is booting");
    switchMessage("Capturing DHCP requests, waiting 60s");
    setTimeout(function() {
        dhcpConf(agent, switchName, ports, portIdx, existingMACs, network, ipOffset, 0);
    }, 30000);
}

function dhcpConf(agent, switchName, ports, portIdx, existingMACs, network, ipOffset, loopNb) {
        switchMessage("Capturing DHCP requests, waiting " + (60 - 30 - loopNb * 10) + "s");
        $.ajax({
            type: "POST",
            url: WEBUI + "/admin/switch/" + agent + "/" + switchName + "/dhcp_conf",
            dataType: 'json',
            contentType: 'application/json',
            async: false,
            data: JSON.stringify({"port": ports[portIdx], "macs": existingMACs, "base_name": agent, "network": network, "ip_offset": ipOffset }),
            success: function (data) {
                if(data["errors"].length > 0) {
                    cleanDetect(agent, switchName);
                    for(error of data["errors"]) {
                        if(error.includes("DHCP configuration")) {
                            error = error + " <a href=\"javascript:deleteDHCPRule('" + switchName + "', '" +
                                error.split(" ")[0] + "')\">Update the DHCP configuration</a> to delete " +
                                error.split(" ")[0] + ".";
                        }
                        switchMessage(error, "text-danger");
                    }
                } else {
                    if("node_ip" in data && data["node_ip"].length > 0) {
                        switchMessage("The node on the port " + ports[portIdx] + " has the IP '" + data["node_ip"] + "'");
                        switchMessage("Rebooting the node");
                        switchMessage("Configuring the node on the port " + ports[portIdx] + ", waiting 120s");
                        setTimeout(function() {
                            nodeConf(agent, switchName, ports, portIdx, existingMACs, network, ipOffset, data["node_ip"], 0);
                        }, 40000);
                    } else {
                        if(loopNb < 3) {
                            loopNb++;
                            setTimeout(function() {
                                dhcpConf(agent, switchName, ports, portIdx, existingMACs, network, ipOffset, loopNb);
                            }, 10000);
                        } else {
                            cleanDetect(agent, switchName);
                            switchMessage("No IP detects for the node on the port " + ports[portIdx] +
                                ". Check the node MAC address is not already in the DHCP configuration.", "text-danger");
                        }
                    }
                }
            },
            error: function () {
                alert("Error: can not send the request");
            },
        });
}


function nodeConf(agent, switchName, ports, portIdx, existingMACs, network, ipOffset, nodeIp, loopNb) {
    switchMessage("Configuring the node on the port " + ports[portIdx] + ", waiting " + (120 - 40 - loopNb * 10) + "s");
    $.ajax({
        type: "POST",
        url: WEBUI + "/admin/switch/" + agent + "/" + switchName + "/node_conf",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify( {"port": ports[portIdx], "node_ip": nodeIp, "base_name": agent} ),
        success: function (data) {
            if(data["errors"].length > 0) {
                cleanDetect(agent, switchName);
                for(error of data["errors"]) {
                    switchMessage(error, "text-danger");
                }
            } else {
                if(data["serial"].length > 0) {
                    // The node is turned off, update the square color
                    $("#" + switchName + "-table").find(".col").each(function(idx, port) {
                        if(ports[portIdx] == String(idx + 1)) {
                            $(port).attr("class", "col port-node off");
                        }
                    });
                    switchMessage("The node on the port " + ports[portIdx] + " is configured!", "text-success");
                    // Detecting the next selected node
                    portIdx++;
                    if(portIdx < ports.length) {
                        bootNode(agent, switchName, ports, portIdx, existingMACs, network, ipOffset);
                    } else {
                        switchMessage("All nodes are configured. Cleaning the TFTP directory..");
                        cleanDetect(agent, switchName);
                    }
                } else {
                    if(loopNb < 8) {
                        loopNb++;
                        setTimeout(function() {
                            nodeConf(agent, switchName, ports, portIdx, existingMACs, network, ipOffset, nodeIp, loopNb);
                        }, 10000);
                    } else {
                        switchMessage("Can not get the node information. The node is not configured!", "text-danger");
                        cleanDetect(agent, switchName);
                    }
                }
            }
        },
        error: function () {
            alert("Error: can not send the request");
        },
    });
}

function cleanDetect(agent, switchName) {
    $.ajax({
        type: "POST",
        url: WEBUI + "/admin/switch/" + agent + "/clean_detect",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        success: function (data) {
            if(data["errors"].length > 0) {
                alert(data["errors"]);
            }
            updateSwitchNodes(agent + "-" + switchName);
        },
        error: function () {
            alert("Error: can not send the request");
        },
    });
}
// End of functions for the detect_nodes actions

function loadInfo(select) {
    var info = "";
    switch($(select).val()) {
        case "turn_on":
            info = "Turn the <b>selected</b> ports on. If there are shutdown nodes on these ports, they will be powered on.";
            break;
        case "turn_off":
            info = "Turn the <b>selected</b> ports off. If there are turned on nodes on these ports, they will be shutdown.";
            break;
        case "port_status":
            info = "Retrieve the status (On or Off) of every port.";
            break;
        case "detect_nodes":
            info = "Detect nodes linked to the <b>selected</b> ports. Then, the nodes will be configured to be used as a resource node.";
            break;
    }
    $(select).parent().parent().find("#action-desc").html(info);
}
