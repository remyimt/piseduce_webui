MONTH_STR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Now", "Dec" ];

$(document).ready(function () {
    $.ajax({
        type: "GET",
        url: WEBUI + "/user/monitoring/data",
        dataType: 'json',
        success: function (data) {
            for (agent in data) {
                for (switch_name in data[agent]) {
                    let option = document.createElement("option");
                    option.value = switch_name + "@" + agent;
                    option.text = switch_name + "@" + agent;
                    document.getElementById("switch-list").append(option);
                    // Chart colors (https://mokole.com/palette.html)
                    let colors = [ "darkslategray", "darkmagenta", "deepskyblue", "pink",
                        "saddlebrown", "maroon3", "blue", "darkgreen", "red", "coral", "olive",
                        "orange", "fuchsia", "darkslateblue", "yellow", "dodgerblue",
                        "mediumseagreen", "lawngreen", "palegoldenrod", "navy", "blueviolet",
                        "powderblue", "yellowgreen", "springgreen", "deeppink", "crimson",
                        "aqua", "violet" ];
                    // Configure the charts
                    let label_ts = [];
                    let label_values = [];
                    let datasets_values = [];
                    let offPorts = [];
                    for (port in data[agent][switch_name]) {
                        let one_value = {
                            label: "Port " + port,
                            data: [],
                            fill: false
                        };
                        let port_cons = data[agent][switch_name][port];
                        let nonZero = false;
                        for (cons of port_cons["consumptions"]) {
                            if(!label_ts.includes(cons["time"])) {
                                label_ts.push(cons["time"]);
                            }
                            if(cons["consumption"] > 0) {
                                nonZero = true;
                            }
                            one_value.data.push(cons["consumption"]);
                        }
                        // Add to the chart only ports with non-zero consumption
                        if("node" in port_cons) {
                            one_value.label = port_cons.node;
                        }
                        if(nonZero) {
                            one_value.borderColor = 
                                colors[datasets_values.length % colors.length];
                            datasets_values.push(one_value);
                        } else {
                            offPorts.push(one_value.label);
                        }
                    }
                    // Convert the timestamps to Strings
                    for (time of label_ts) {
                        let myDate = new Date(time * 1000);
                        label_values.push(int2digit(myDate.getDate()) + "-" +
                            MONTH_STR[myDate.getMonth()] + " " + int2digit(myDate.getHours()) +
                            ":" + int2digit(myDate.getMinutes()) + ":" +
                            int2digit(myDate.getSeconds()));
                    }
                    // Build the chart
					let chartDiv = document.createElement("div");
                    chartDiv.style.width = "900px";
					chartDiv.id = switch_name + "_chart";
                    chartDiv.className = "m-auto";
                    let offSpan = document.createElement("span");
                    offSpan.innerHTML = "<b>Turn Off Ports</b>: " + offPorts.join();
					let canvas = document.createElement("canvas");
                    canvas.id = switch_name + "_canvas";
                    chartDiv.append(offSpan);
                    chartDiv.append(canvas);
					document.getElementById("charts").append(chartDiv);
                    // Configure the canvas
					canvas.style.border  = "1px solid";
					let ctx = document.getElementById(canvas.id).getContext('2d');
                    // Add the consumptions
					let myChart = new Chart(ctx, {
						type: 'line',
						data: {
							labels: label_values,
                            datasets: datasets_values
						},
						options: {
							scales: {
								y: {
									beginAtZero: true
								}
							}
						}
					});
                }
            }
            switchCons($("#switch-list"));
        },
        error: function () {
            console.log("error: can not send the request");
        }
    });
});

function int2digit(number) {
    return ("0" + number).slice(-2);
}

function switchCons(select) {
    let switchName = $(select).val().split("@")[0];
    $("div[id$='_chart']").hide();
    $("#" + switchName + "_chart").show();
    $("#switch-name").val(switchName);
}
