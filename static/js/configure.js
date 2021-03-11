// Display nodes and configure type buttons
$(document).ready(function () {
    var hideMe = false;
    var no_node = true;
    var activeButton = [];
    $(".type-selection").children("div").each(function(idx, typeButton) {
        var accordionId = $(typeButton).attr("id").replace("-button", "");
        var accordion = $("#" + accordionId);
        if(accordion.length > 0) {
            no_node = false;
            if(hideMe) {
                // A button is already active, hide the nodes
                accordion.hide();
            } else {
                // Active the button and show the nodes
                $(typeButton).addClass("active");
                hideMe = true;
            }
        } else {
            $(typeButton).addClass("disabled");
        }
    });
    if(no_node) {
        $(".node-config").html("<center>" +
            "No node in the 'configuring' state!<br/>" +
            "<a href='/user/reserve'>Go to the reservation page</a>" +
            "</center>");
    }
});

// Functions
function cancelReservation() {
    alert("Not implemented yet");
}

function copyConfiguration(nodeName) {
    var accordion = {}
    var inputConfig = [];
    var selectConfig = [];
    $(".card-body .properties").each(function(useless, node) {
        var myAccordion = $(node).parent().parent().parent().parent()[0];
        if(myAccordion.id == accordion.id) {
            console.log(node.id.replace("-props", ""));
            $("#heading-" + node.id.replace("-props", "") + " a").removeClass("font-weight-bold");
            // Write the properties
            $(node).find(".col").children("input").each(function(idx, input) {
                $(input).val(inputConfig[idx]);
            });
            $(node).find(".col").children("select").each(function(idx, select) {
                $(select).val(selectConfig[idx]);
            });
        }
        if(node.id.startsWith(nodeName)) {
            // Get my accordion
            accordion = myAccordion;
            // Put the link in bold
            $("#heading-" + nodeName + " a").addClass("font-weight-bold");
            // Save the properties
            $(node).find(".col").children("input").each(function(idx, input) {
                inputConfig.push($(input).val());
            });
            $(node).find(".col").children("select").each(function(idx, select) {
                selectConfig.push($(select).val());
            });
        }
    });
}

function removeBold(headerId) {
    $("#" + headerId).removeClass("font-weight-bold");
}

function nodeSelection(typeButton) {
    if(!typeButton.classList.contains("disabled")) {
        $(".type-selection").children("div").each(function(idx, allButton) {
            var accordionId = $(allButton).attr("id").replace("-button", "");
            if(allButton == typeButton) {
                $("#" + accordionId).show();
                $(allButton).addClass("active");
            } else {
                if(!$(allButton).hasClass("disabled")) {
                    $("#" + accordionId).hide();
                    $(allButton).removeClass("active");
                }
            }
        });
    }
}

function showDesc(inputTag) {
    var propName = $(inputTag).attr("name");
    if(propName.includes("-")) {
        propName = propName.split("-");
        propName = propName[propName.length - 1];
    }
    switch(propName) {
        case "duration":
            desc = "The duration of the deployment in hours. The maximum value is 72 hours.";
            break;
        case "environment":
            desc = "The environment to deploy on the node:<br/>" +
                "<ul>" + 
                "<li><b>raspbian_32bit</b>: 32-bit Raspbian Lite Operating System</li>" +
                "<li><b>raspbian_64bit</b>: 64-bit Raspbian Lite Operating System</li>" +
                "<li><b>raspbian_ttyd</b>: 32-bit Raspbian Lite Operating System with a shell available from web navigators</li>" +
                "<li><b>raspbian_cloud9</b>: 32-bit Raspbian Lite Operating System with the web IDE cloud9</li>" +
                "<li><b>tiny_core</b>: 32-bit tinycore v11. A minimal environment very fast to deploy</li>" +
                "<li><b>ubuntu_20.04_32bit</b>: 32-bit Ubuntu 20.04</li>" +
                "<li><b>ubuntu_20.04_64bit</b>: 64-bit Ubuntu 20.04</li>" +
                "</ul>";
            break;
        case "bin":
            desc = "Node bins are used to create node groups that will facilitate the node management.";
            break;
        case "part_size":
            desc = "The size of the main partition of the operating system. In most cases, the 'Whole' value must be selected. Only users who want to create multiple partitions should choose another value.";
            break;
        case "os_password":
            desc = "The password for the operating system, the web services (ttyd,  cloud9), the SSH connections. Leave blank to generate a different password for every node.";
            break;
        case "update_os":
            desc = "Update the operating system during the deployment.";
            break;
        default:
            desc = "Unknown property! Oooops ;)";
    }
    $(".desc").html(desc);
}
