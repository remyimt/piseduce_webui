function workerVPNKey(name) {
    var subnet = "";
    if(name.length == 0) {
        name = $("#worker-name").val();
        subnet = $("#worker-subnet").val();
    } else {
        subnet = $("#" + name + "-subnet").val();
    }
    if(name.length == 0) {
        alert("Name field is required");
        $("#worker-name").focus();
        return;
    }
    if(subnet.length == 0) {
        alert("Subnet field is required");
        $("#worker-subnet").focus();
        return;
    }
    subnet_array = subnet.split(".");
    console.log(subnet_array[3]);
    if(subnet_array.length != 4 || subnet_array[3] != 0) {
        alert("Subnet value must be IP like 10.20.0.0 (note the ending 0)");
        return;
    }
    console.log(WEBUI + "/admin/vpn/generate/" + name + "/" + subnet);
    $.ajax({
        type: "GET",
        url: WEBUI + "/admin/vpn/generate/" + name + "/" + subnet,
        dataType: 'json',
        success: function (data) {
            if(data["errors"].length == 0) {
                window.location.href = WEBUI + "/admin/vpn";
            } else {
                window.location.href = WEBUI + "/admin/vpn?msg=" + data["errors"][0];
            }
        },
        error: function() {
            alert("error: wrong request");
        }
    });
}
