// Global variables
var NODES = {}
var PROPERTIES = {}
var MONTHES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Dec" ]

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
    updateNodeSchedule();
    // Update the state every 60s
    setInterval(updateNodeSchedule, 60000);
});

// Functions
function convertHour(hourInt) {
    var result = hourInt;
    if(hourInt > 23) {
        result = hourInt - 24;
    }
    if(hourInt < 0) {
        result = hourInt + 24;
    }
    return String(result).padStart(2, "0");
}

// hoursAdded must be 48 (next two days) or -48 (previous 2 days)
function updateNodeSchedule(hoursAdded=0) {
    // Compute the date of the 2 days to display
    var d1 = $("#d1");
    var d1Html = d1.html().replace(/\s/g, "");
    var firstDay;
    if(d1Html.length == 0) {
        hoursAdded = 48;
        // Display the reserved dates from today
        firstDay = new Date();
    } else {
        // Display the reserved dates from the next two days
        firstDay = new Date($("#d1").html() + " 00:00:00 GMT");
        firstDay.setHours(firstDay.getHours() + hoursAdded);
    }
    var secondDay = new Date(firstDay);
    secondDay.setHours(secondDay.getHours() + 24);
    // Display the dates
    d1.html(firstDay.getDate() + " " + MONTHES[firstDay.getMonth()] + " " + firstDay.getFullYear());
    $("#d2").html(secondDay.getDate() + " " + MONTHES[secondDay.getMonth()] + " " + secondDay.getFullYear());
    // Mark the reserved hours in red
    $.ajax({
        type: "GET",
        url: WEBUI + "/user/node/schedule",
        dataType: 'json',
        success: function (data) {
            // Reset the schedule
            $(".one-hour").attr("class", "one-hour free");
            $(".one-hour").each(function(idx, div) {
                if(div.title.includes("reserved")) {
                    var firstLine = div.title.split("\n")[0];
                    div.title = firstLine.replace("reserved", "free");
                }
                if(div.title.includes("now")) {
                    var firstLine = div.title.split("\n")[0];
                    div.title = firstLine;
                }
            });
            // Data processing: mark the reserved hours in red
            data = data["nodes"];
            var dayBefore = new Date(firstDay);
            dayBefore.setHours(firstDay.getHours() - 24);
            var dayBeforeUTC = dayBefore.toISOString().split("T")[0];
            var firstDayUTC = firstDay.toISOString().split("T")[0];
            var secondDayUTC = secondDay.toISOString().split("T")[0];
            var dayAfter = new Date(secondDay);
            dayAfter.setHours(secondDay.getHours() + 24);
            var dayAfterUTC = dayAfter.toISOString().split("T")[0];
            var hourUTCInt = parseInt(firstDay.toISOString().split("T")[1].substring(0, 2));
            var offset = firstDay.getHours() - hourUTCInt;
            // Colour the hour divs to indicate the current hour
            var today = new Date();
            if(firstDay.getFullYear() == today.getFullYear() &&
                firstDay.getMonth() == today.getMonth() &&
                firstDay.getDate() == today.getDate()) {
                    $(".schedule").each(function(idx, div) {
                        var nowDiv = $(div).find(".one-hour:nth-child(" + (today.getHours() + 1) + ")").first();
                        nowDiv.attr("class", "one-hour now").attr("title", nowDiv.attr("title") + "\nnow");
                    });
            }
            // Detect the reserved hours for the first day and the second day
            for (var node in NODES) {
                var firstDayHours = [];
                var secondDayHours = [];
                if(node in data) {
                    if(offset > 0 && dayBeforeUTC in data[node]) {
                        // Check the UTC hours of the day before the first day that could be included in the first day
                        for(hour of data[node][dayBeforeUTC]) {
                            localHour = parseInt(hour) + offset;
                            if(localHour > 23) {
                                firstDayHours.push(localHour - 24);
                            }
                        }
                    }
                    if(firstDayUTC in data[node]) {
                        for(hour of data[node][firstDayUTC]) {
                            localHour = parseInt(hour) + offset;
                            // Add the UTC hours of the first day
                            if(localHour >= 0 && localHour < 24) {
                                firstDayHours.push(localHour);
                            }
                            // Add the UTC hours of the second day
                            if(localHour > 23) {
                                secondDayHours.push(localHour - 24);
                            }
                        }
                    }
                    if(secondDayUTC in data[node]) {
                        for(hour of data[node][secondDayUTC]) {
                            localHour = parseInt(hour) + offset;
                            // Add the UTC hours of the first day
                            if(localHour < 0) {
                                firstDayHours.push(localHour + 24);
                            }
                            // Add the UTC hours of the second day
                            if(localHour >= 0 && localHour < 24) {
                                secondDayHours.push(localHour);
                            }
                        }
                    }
                    if(offset < 0 && dayAfterUTC in data[node]) {
                        // Check the UTC hours of the day after the second day that could be included in the second day
                        for(hour of data[node][dayAfterUTC]) {
                            localHour = parseInt(hour) + offset;
                            if(localHour < 0) {
                                secondDayHours.push(localHour + 24);
                            }
                        }
                    }
                    for (hour of firstDayHours) {
                        // Display the reservation at the first day
                        $("#" + node + "-d1hour" + hour).attr("class", "one-hour reserved");
                        div = $("#" + node + "-d1hour" + hour);
                        if(div.attr("title").includes("free")) {
                            startH = convertHour(parseInt(data[node]["start_hour"].substring(0, 2)) + offset);
                            endH = convertHour(parseInt(data[node]["end_hour"].substring(0, 2)) + offset);
                            div.attr("title", div.attr("title").replace("free", "reserved") + "\n" +
                                data[node]["owner"] + "\n" +
                                startH + ":" + 
                                data[node]["start_hour"].substring(3, 5) + " - " +
                                endH + ":" + 
                                data[node]["end_hour"].substring(3, 5));
                        }
                    }
                    for (hour of secondDayHours) {
                        // Display the reservation at the first day
                        $("#" + node + "-d2hour" + hour).attr("class", "one-hour reserved");
                        div = $("#" + node + "-d2hour" + hour);
                        if(div.attr("title").includes("free")) {
                            startH = convertHour(parseInt(data[node]["start_hour"].substring(0, 2)) + offset);
                            endH = convertHour(parseInt(data[node]["end_hour"].substring(0, 2)) + offset);
                            div.attr("title", div.attr("title").replace("free", "reserved") + "\n" +
                                data[node]["owner"] + "\n" +
                                startH + ":" + 
                                data[node]["start_hour"].substring(3, 5) + " - " +
                                endH + ":" + 
                                data[node]["end_hour"].substring(3, 5));
                        }
                    }
                }// node in data - if
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
                $("#" + node).parent().hide();
            } else {
                $("#" + node).parent().show();
                nb_nodes++;
            }
        }
    } else {
        $(".node-schedule").show();
        $(".node-schedule").each(function() {
            nb_nodes++;
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
    var nodeName = $(".node-name").first().children("span").html();
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
    var nodeName = $(node).children("span").html();
    var filter = $("<div class='filter'></div>");
    var filterProp = $("<div></div>");
    filterProp.append($("<span>name: " + nodeName + "</span>"));
    var typeSpan = $("<span>agent: " + NODES[nodeName]["agent"] + "</span>");
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
        // Total number of requested nodes
        var total_requested = 0;
        // Iterate over .filter elements to add the nodes to the reservation
        $(".selectednodes .ready-nodes").children().each(function() {
            // Read the span tags to get the filter information
            $(this).children().each(function(idx, spanContainer) {
                if(idx == 0) {
                    // Iterate over the span tags to build the filter
                    var spanArray = $(spanContainer).children("span").toArray();
                    var nb_nodes = parseInt(spanArray.pop().innerHTML.split(' ')[0]);
                    var filter = { "nb_nodes": nb_nodes };
                    total_requested += nb_nodes;
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
                if(data["total_nodes"] == 0) {
                    alert("The requested nodes are not available on this period!");
                } else {
                    if(data["total_nodes"] < total_requested) {
                        alert("Some nodes are missing.\nConfigure the reserved nodes or cancel your reservation!");
                    }
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
