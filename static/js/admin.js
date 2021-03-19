// When loading the admin switch page, get the nodes connected to the switches
$(document).ready(function () {
    updateSwitchNodes();
    displayTable($("#switch-list"));
});

// Functions);
function updateSwitchNodes() {
    $("#switch-list").children("option").each(function(useless, option) {
        var switchName = option.text;
        if(switchName != "-") {
            var worker = $("#" + switchName + "-worker").val();
            $.ajax({
                type: "POST",
                url: "http://" + WEBUI + "/admin/switch/" + worker + "/" + switchName + "/nodes",
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
    });
}

function displayTable(select) {
    $(".switch-table").hide();
    $("#" + $(select).val()).show()
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
    var worker = $("#" + switchName + "-worker").val();
    var ports = [];
    var conf_name = $("#" + switchName + "-actions").val();
    $("#" + switchName + "-table").find("input:checked").each(function(useless, port_str) {
        ports.push($(port_str).attr("name").split("-")[1]);
        $(port_str).prop("checked", false);
    });
    if(conf_name == "port_status" || ports.length > 0) {
        switch(conf_name) {
            case "detect_nodes":
                initDetect(worker, switchName, ports);
                break;
            case "port_status":
                $.get( "http://" + WEBUI + "/admin/switch/" + worker + "/" + switchName, function(data) {
                    var data = JSON.parse(data);
                    console.log(data);
                    $("#" + switchName + "-table").find(".col").each(function(idx, port) {
                        $(port).attr("class", "col port-node " + data[switchName][idx]);
                    });
                });
                break;
            case "turn_off":
                turnOff(worker, switchName, ports);
                break;
            case "turn_on":
                turnOn(worker, switchName, ports);
                break;
        }
    } else {
        alert("No selected ports. Please select ports by ticking the checkboxes");
    }
}

function turnOff(worker, switchName, ports) {
    $.ajax({
        type: "POST",
        url: "http://" + WEBUI + "/admin/switch/" + worker + "/" + switchName + "/turn_off",
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

function turnOn(worker, switchName, ports) {
    $.ajax({
        type: "POST",
        url: "http://" + WEBUI + "/admin/switch/" + worker + "/" + switchName + "/turn_on",
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
function initDetect(worker, switchName, ports) {
    $(".switch-console").empty();
    $(".switch-console").show();
    switchMessage("Preparing the NFS boot for nodes on ports " + ports);
    $.ajax({
        type: "POST",
        url: "http://" + WEBUI + "/admin/switch/" + worker + "/init_detect",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify( {"ports": ports} ),
        success: function (data) {
            if(data["errors"].length > 0) {
                for(error of data["errors"]) {
                    if(error.includes("DHCP configuration")) {
                        var msg = error + " <a href=\"javascript:deleteDHCPRule('" + switchName + "', '" +
                            error.split(" ")[0] + "')\">Update the DHCP configuration</a> to delete " +
                            error.split(" ")[0] + ".";
                        switchMessage(msg, "text-danger");
                    } else {
                        switchMessage(error, "text-danger");
                    }
                }
            } else {
                switchMessage("Turn off nodes on the selected ports");
                turnOff(worker, switchName, ports);
                bootNode(worker, switchName, ports, 0, data["network"], data["macs"]);
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
    var worker = $("#" + switchName + "-worker").val();
    if(ip_mac.includes(":")) {
        mac = ip_mac;
    } else {
        ip = ip_mac;
    }
    $.ajax({
        type: "POST",
        url: "http://" + WEBUI + "/admin/switch/" + worker + "/" + switchName + "/dhcp_conf/del",
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

function bootNode(worker, switchName, ports, portIdx, baseIP, existingMACs) {
    switchMessage("Turn on the node on port " + ports[portIdx], "text-warning");
    turnOn(worker, switchName, [ ports[portIdx] ]);
    switchMessage("The node on port " + ports[portIdx] + " is booting");
    setTimeout(function() {
        dhcpConf(worker, switchName, ports, portIdx, baseIP, existingMACs, 0);
    }, 5000);
}

function dhcpConf(worker, switchName, ports, portIdx, baseIP, existingMACs, loopNb) {
        switchMessage("Capturing DHCP requests, waiting " + (30 - loopNb * 10) + "s");
        $.ajax({
            type: "POST",
            url: "http://" + WEBUI + "/admin/switch/" + worker + "/" + switchName + "/dhcp_conf",
            dataType: 'json',
            contentType: 'application/json',
            async: false,
            data: JSON.stringify({"port": ports[portIdx], "macs": existingMACs, "network": baseIP}),
            success: function (data) {
                if("node_ip" in data && data["node_ip"].length > 0) {
                    switchMessage("The node 'node-" + ports[portIdx] + "' has the IP '" + data["node_ip"] + "'");
                    switchMessage("Rebooting the node");
                    switchMessage("Configuring the node 'node-" + ports[portIdx] + "', waiting 90s");
                    setTimeout(function() {
                        nodeConf(worker, switchName, ports, portIdx, baseIP, existingMACs, data["node_ip"], 0);
                    }, 40000);
            } else {
                    if(loopNb < 3) {
                        loopNb++;
                        setTimeout(function() {
                            dhcpConf(worker, switchName, ports, portIdx, baseIP, existingMACs, loopNb);
                        }, 10000);
                    } else {
                        switchMessage("No IP detects for the node on the port " + ports[portIdx] +
                            ". Check the node MAC address is not already in the DHCP configuration.", "text-danger");
                    }
                }
            },
            error: function () {
                alert("Error: can not send the request");
            },
        });
}


function nodeConf(worker, switchName, ports, portIdx, baseIP, existingMACs, nodeIp, loopNb) {
    switchMessage("Configuring the node 'node-" + ports[portIdx] + "', waiting " + (90 - 40 - loopNb * 10) + "s");
    $.ajax({
        type: "POST",
        url: "http://" + WEBUI + "/admin/switch/" + worker + "/" + switchName + "/node_conf",
        dataType: 'json',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify( {"port": ports[portIdx], "node_ip": nodeIp} ),
        success: function (data) {
            if(data["errors"].length > 0) {
                alert(data["errors"]);
            } else {
                // The node is turned off, update the square color
                $("#" + switchName + "-table").find(".col").each(function(idx, port) {
                    if(ports[portIdx] == String(idx + 1)) {
                        $(port).attr("class", "col port-node off");
                    }
                });
                // Detecting the next selected node
                portIdx++;
                if(portIdx < ports.length) {
                    bootNode(worker, switchName, ports, portIdx, baseIP, existingMACs);
                } else {
                    updateSwitchNodes();
                    switchMessage("All nodes are configured.");
                }
            }
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
