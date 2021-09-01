// Display nodes and configure type buttons
$(document).ready(function () {
    let showNodes = true;
    let no_node = true;
    let activeButton = [];
    // Disable buttons if there is no node for the button type
    $(".type-selection").children("div").each(function(idx, typeButton) {
        let buttonId = $(typeButton).attr("id");
        let nodeType = buttonId.substring(0, buttonId.lastIndexOf("-"));
        if($(".accordion").filter("[id$='" + nodeType + "']").children(".card").length == 0) {
            $(typeButton).addClass("disabled");
            $("#" + nodeType + "-states").hide();
        } else if(showNodes) {
            showNodes = false;
            no_node = false;
            nodeSelection(typeButton);
        }
    });
    if(no_node) {
        $(".manage").append("<center>" +
            "No node found from your credentials!<br/>" +
            "<a href='/user/reserve'>Go to the reservation page</a>" +
            "</center>");
    }
    updateNodeStatus();
    setInterval(updateNodeStatus, 10000);
});

// Functions
function updateNodeStatus() {
    // Get the number of nodes in the page
    $.ajax({
        type: "GET",
        url: WEBUI + "/user/node/updating",
        dataType: 'json',
        success: function (data) {
            if(data["errors"].length > 0) {
                return;
            }
            delete data["errors"];
            // Compute the number of nodes displayed in the HTML page
            let uiNbNodes = $(".card-header").length;
            // Compute the number of nodes described in the agent data
            let dataNbNodes = 0;
            for (bin in data) {
                for (nodeType in data[bin]) {
                    dataNbNodes += data[bin][nodeType].length
                }
            }
            // Reload the page to remove destroyed nodes
            if(uiNbNodes != dataNbNodes) {
                location.reload();
                return;
            }
            // Update the state
            for (bin in data) {
                for (nodeType in data[bin]) {
                    for (node of data[bin][nodeType]) {
                        osPwd = $("#" + node["name"] + "-os_password");
                        if(Object.keys(osPwd).length == 0 && "os_password" in node) {
                            // Reload the page to display the password
                            location.reload();
                        }
                        let nameDiv = $("#" + node["name"] + "-name");
                        if("percent" in node && node["state"] == "env_check") {
                            nameDiv.html(node["name"] + " - " + node["percent"] + "%");
                        } else {
                            if(nameDiv.html() != node["name"]) {
                                nameDiv.html(node["name"]);
                            }
                        }
                        let oldStatus = $("#" + node["name"] + "-state");
                        if(oldStatus.html() != node["state"]) {
                            oldStatus.html(node["state"]);
                            $("#" + node["name"] + "-circle").attr("class", "rounded-circle " + node["state"]);
                            $("#" + node["name"] + "-circle").attr("title", node["state"]);
                        }
                    }
                }
            }
        },
        error: function () {
            console.log("error: can not send the request");
        }
    });
}

function loadInfo(select) {
    let info = "";
    switch($(select).val()) {
        case "hardreboot":
            info = "Hard reboot nodes by turning off and on the power supply.";
            break;
        case "bootfiles":
            info = "Upload /boot directory to the TFTP server in order to update the boot files.<br/>" +
            "This operation can be required after upgrading the operating system of the node.<br/>" +
            "We <b>highly recommend to reboot the node</b> after uploading the boot files in order to load them.";
            break;
        case "deployagain":
            info = "Deploy node environments again on nodes. All existing data will be erased.";
            break;
        case "destroy":
            info = "Free nodes by canceling reservations.";
            break;
        case "extend":
            info = "Extend reservations by postponing the end date to a later date.<br/>" +
                "The maximum duration of reservations is 7 days.";
            break;
    }
    $(select).parent().parent().find("#action-desc").html(info);
}

function reconfigure(binName) {
    let nodeNames = {};
    let reconfiguration = $("#" + binName + "-select").val();
    $(".accordion:visible").each(function(idx, accordion) {
        if(accordion.id.startsWith(binName)) {
            $(accordion).find(".node-name").each(function(idx, name) {
                let imgName = name.parentNode.children[2].src.split("/");
                if(imgName[imgName.length - 1].startsWith("enabled")) {
                    let agent = $("#" + name.innerHTML + "-agent").val();
                    if(!(agent in nodeNames)) {
                        nodeNames[agent] = []
                    }
                    nodeNames[agent].push(name.innerHTML);
                }
            });
        }
    });
    if(Object.keys(nodeNames).length > 0) {
        $.ajax({
            type: "POST",
            url: WEBUI + "/user/make/exec",
            dataType: 'json',
            contentType: 'application/json',
            async: false,
            data: JSON.stringify({"reconfiguration": reconfiguration, "nodes": nodeNames}),
            success: function (data) {
                if(data["errors"].length > 0) {
                    alert("Reconfigurations error: " + data["errors"]);
                } else {
                    window.location.reload(false);
                }
            },
            error: function () {
                alert("internal error: reconfiguration is canceled");
            },
        });
    } else {
        alert("Please select nodes by ticking the checkbox on the right of the node name.")
    }
}

function destroyBin(binName) {
    let nodeNames = {};
    let activeButtonId = $(".type-selection").children("div.active").attr('id');
    let nodeType = activeButtonId.substring(0, activeButtonId.lastIndexOf("-"));
    let accordion = $("#" + binName+ "-" + nodeType);
    if(accordion.length > 0) {
        accordion.find(".node-name").each(function(useless, node) {
            let nodeName = node.innerHTML;
            let agent = $("#" + nodeName + "-agent").val();
            if(!(agent in nodeNames)) {
                nodeNames[agent] = []
            }
            nodeNames[agent].push(nodeName);
        });
    }
    if(Object.keys(nodeNames).length > 0) {
        $.ajax({
            type: "POST",
            url: WEBUI + "/user/make/exec",
            dataType: 'json',
            contentType: 'application/json',
            async: false,
            data: JSON.stringify({"reconfiguration": "destroy", "nodes": nodeNames}),
            success: function (data) {
                if(data["errors"].length > 0) {
                    alert("Reconfigurations error: " + data["errors"]);
                } else {
                    window.location.reload(false);
                }
            },
            error: function () {
                alert("internal error: reconfiguration is canceled");
            },
        });
    }
}

function nodeSelection(typeButton) {
    let buttonId = $(typeButton).attr("id");
    let nodeType = buttonId.substring(0, buttonId.lastIndexOf("-"));
    if(!typeButton.classList.contains("disabled")) {
        // Enable the buttons with the right type
        $(".type-selection").children("div").each(function(idx, tButton) {
            if(tButton.id.includes(nodeType)) {
                $(tButton).addClass("active");
                $("#" + nodeType + "-states").show();
            } else {
                $(tButton).removeClass("active");
                let buttonId = tButton.id;
                let myType = buttonId.substring(0, buttonId.lastIndexOf("-"));
                $("#" + myType + "-states").hide();
            }
        });
        // Show the nodes with the right type
        $(".accordion").each(function(idx, accordion) {
            if(accordion.id.includes(nodeType)) {
                $(accordion).show();
            } else {
                $(accordion).hide();
            }
        });
    }
}

function tickNode(elem) {
    // Do not propage to not open the accordion
    event.stopPropagation();
    let img_name = elem.getAttribute("src").split("/")[3];
    if(img_name.includes("disabled")) {
        elem.setAttribute("src", "/static/img/enabled-checkbox.png");
    } else {
        elem.setAttribute("src", "/static/img/disabled-checkbox.png");
    }
}
