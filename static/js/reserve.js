// Global variables
var NODES = {}
var PROPERTIES = {}

// Configure the global variables and display the nodes
$(document).ready(function () {
    // Set today as the default date value of the reservation beginning date
    var now = new Date()
    var dateStr = now.toJSON().split("T")[0];
    var hourStr = now.getHours();
    var minuteStr = now.getMinutes();
    $('#start-date').val(dateStr);
    $('#start-hours').val(hourStr);
    $('#start-minutes').val(minuteStr);
    // Compute the node property list used to create filters
    $.ajax({
        type: "GET",
        url: WEBUI + "/user/node/list",
        dataType: 'json',
        success: function (data) {
            NODES = data["nodes"];
            for (var node in NODES) {
                // Get the properties with values to build the filters
                for (var prop in NODES[node]) {
                    if(NODES[node][prop] != null && NODES[node][prop].length > 0) {
                        if(!(prop in PROPERTIES)) {
                            PROPERTIES[prop] = new Set();
                        }
                        PROPERTIES[prop].add(NODES[node][prop]);
                    } else {
                        // Delete unused properties
                        delete NODES[node][prop];
                    }
                }
            }
            // Sort the properties
            for (var prop of Array.from(Object.keys(PROPERTIES)).sort()) {
                // Add the property name to the selector
                $("#prop-names").append($("<option value='" + prop + "'>"));
            }
        },
        error: function () {
            console.log("error: can not send the request");
        },
    });
    // Set default values
    filterNodes();
    // Update the status every 10s
    setInterval(updateNodeStatus, 10000);
});

// Functions
function updateNodeStatus() {
    $.ajax({
        type: "GET",
        url: WEBUI + "/user/node/list",
        dataType: 'json',
        success: function (data) {
            var current = data["nodes"]
            updated = false;
            for (var node in current) {
                // Update the status property
                if(NODES[node]["status"] != current[node]["status"]) {
                    updated = true;
                    NODES[node]["status"] = current[node]["status"];
                    if(NODES[node]["status"] == "available") {
                        $("#" + node).attr("class", "node free");
                    } else {
                        $("#" + node).attr("class", "node reserved");
                    }
                }
            }
            if(updated) {
                filterNodes();
            }
        },
        error: function() {
            console.log("error: can not send the request");
        }
    });
}

function showInfoView(nodeName) {
    $("#info-node").empty();
    for (var prop in NODES[nodeName]) {
        $("#info-node").append($("<div class='info-prop'>" + prop + ": " + NODES[nodeName][prop] + "</div>"));
    }
    $(".info-view").fadeIn(200);
    event.stopPropagation();
}

function hideInfoView() {
    $(".info-view").fadeOut(400);
}

function displayPropValues() {
    if($("#prop-names-list").val().length > 0) {
        $("#prop-values").empty();
        for (var value of PROPERTIES[$("#prop-names-list").val()]) {
            $("#prop-values").append($("<option value='" + value + "'>"));
        }
    }
}

function addFilter() {
    var filterName = $("#prop-names-list").val();
    var filterValue = $("#prop-values-list").val();
    if(filterName.length > 0 && filterValue.length > 0) {
        var filter = $("<div class='filter'></div>");
        var filterProp = $("<div></div>");
        filterProp.append($("<span>" + filterName + "</span><br/>"));
        filterProp.append($("<span>" + filterValue + "</span>"));
        filter.append(filterProp);
        filter.append($("<div class='suppr' onclick='deleteFilter(this)'>&#x2212;</div>"));
        $(".filters").append(filter);
    }
    $("#prop-names-list").val("");
    $("#prop-values-list").val("");
    filterNodes();
}

function deleteFilter(supprButton) {
    $(supprButton).parent().remove();
    filterNodes();
}

function filterNodes() {
    var filtersHTML = $(".filters .filter div:first-child");
    var filters = {}
    var nb_nodes = 0;
    if(filtersHTML.length > 0) {
        filtersHTML.each(function(idx, div) {
            spans = $(div).children("span").toArray();
            filters[spans[0].innerHTML] = spans[1].innerHTML;
        });
        for (var node in NODES) {
            // Hide the nodes with wrong value for the property 'name'
            var hideNode = false;
            for (var name in filters) {
                if( !(name in NODES[node]) || NODES[node][name] != filters[name]) {
                    hideNode = true;
                }
            }
            if(hideNode) {
                $("#" + node).hide();
            } else {
                $("#" + node).show();
                if(!$("#" + node).hasClass("reserved")) {
                    nb_nodes++;
                }
            }
        }
    } else {
        $(".node").show();
        $(".node").each(function() {
            if(!$(this).hasClass("reserved")) {
                nb_nodes++;
            }
        });
    }
    $(".fuzzy input").val("1");
    $("#nb_print").html("1");
    $(".fuzzy input").attr({ "max": nb_nodes});
    $("#max-number").html(nb_nodes);
}

function updateNbPrint(inputField) {
    $("#nb_print").html($(inputField).val());
}

function addFilterSelection() {
    var filtersHTML = $(".filters .filter div:first-child");
    var filter = $("<div class='filter'></div>");
    var filterProp = $("<div></div>");
    var nodeItems = $(".nodeitems").children();
    if(nodeItems.length == 0) {
        alert("Wrong filter! No selected node.");
        return;
    }
    filtersHTML.each(function(idx, div) {
        // Spans containing the properties to append to the filter selection
        var spans = $(div).children("span").toArray();
        var span = $("<span>" + spans[0].innerHTML + ": " + spans[1].innerHTML + "</span>");
        if(idx > 0) {
            // Show only the first property
            span.hide();
        }
        filterProp.append(span);
    });
    // Append the type of the first displayed node to the selection filter
    var nodeName = nodeItems.first().children("div").first().html();
    var span = $("<span>type: " + NODES[nodeName]["type"] + "</span>");
    if(filterProp.children().length > 0) {
      span.hide();
    }
    filterProp.append(span);
    // Add the delete button
    filterProp.append($("<br/>"));
    filterProp.append($("<span>" + $(".fuzzy input").val() + " node(s)</span>"));
    filter.append(filterProp);
    filter.append($("<div class='suppr' onclick='deleteFilter(this)'>&#x2212;</div>"));
    $(".selectednodes .ready-nodes").append(filter);
    // Remove all filters
    $(".filters").empty();
    filterNodes();
}

function addNameFilter(node) {
    var nodeName = $(node).children("div").html();
    var filter = $("<div class='filter'></div>");
    var filterProp = $("<div></div>");
    filterProp.append($("<span>name: " + nodeName + "</span>"));
    var typeSpan = $("<span>type: " + NODES[nodeName]["type"] + "</span>");
    typeSpan.hide();
    filterProp.append(typeSpan);
    filterProp.append($("<br/>"));
    filterProp.append($("<span>1 node(s)</span>"));
    filter.append(filterProp);
    filter.append($("<div class='suppr' onclick='deleteFilter(this)'>&#x2212;</div>"));
    $(".selectednodes .ready-nodes").append(filter);
}

function leadingZero(number) {
    return String(number).padStart(2, "0");
}

function reserveNodes() {
    var filters = []
    if($(".selectednodes .ready-nodes").children().length > 0) {
        // Build the beginning date
        var startDate = new Date($("#start-date").val());
        startDate.setHours($("#start-hours").val());
        startDate.setMinutes($("#start-minutes").val());
        var startDateStr = startDate.getUTCFullYear() + "-" +
            leadingZero(startDate.getUTCMonth() + 1) + "-" +
            leadingZero(startDate.getUTCDate()) + " " +
            leadingZero(startDate.getUTCHours()) + ":" +
            leadingZero(startDate.getUTCMinutes()) + ":" +
            leadingZero(startDate.getUTCSeconds());
        // Today, 15 minutes earlier
        var today = new Date(Date.now() - 15 * 60000);
        if(startDate < today) {
            alert("The beginning date is expired. Do not laugh at me!");
            return;
        }
        var duration = parseInt($("#duration").val());
        if(duration > 72) {
            alert("The maximum duration for a reservation is 72 hours");
            return;
        }
        // Iterate over .filter elements to add the nodes to the reservation
        $(".selectednodes .ready-nodes").children().each(function() {
            // Read the span tags to get the filter information
            $(this).children().each(function(idx, spanContainer) {
                if(idx == 0) {
                    // Iterate over the span tags to build the filter
                    var spanArray = $(spanContainer).children("span").toArray();
                    var nb_nodes = spanArray.pop().innerHTML.split(' ')[0];
                    var filter = { "nb_nodes": nb_nodes };
                    for (var span of spanArray) {
                        var prop = span.innerHTML.replace(" ", "").split(":");
                        filter[prop[0]] = prop[1];
                    }
                    filters.push(filter);
                }
            });
        });
        $.ajax({
            type: "POST",
            //the url where you want to sent the userName and password to
            url: WEBUI + "/user/make/reserve",
            dataType: 'json',
            contentType: 'application/json',
            async: false,
            data: JSON.stringify({ "filters": filters, "start_date": startDateStr, "duration": duration}),
            success: function (data) {
                if(data["errors"].length > 0) {
                    alert("Reservation error: " + data["errors"]);
                } else {
                    window.location.href = WEBUI + "/user/configure";
                }
            },
            error: function () {
                alert("Error: can not send the request");
            },
        });
    } else {
        alert("Please select nodes before start the deployment");
    }
}
