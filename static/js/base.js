WEBUI = ""

$(document).ready(function () {
    // Read the hidden input to get the IP and the port of the webUI API
    WEBUI = $("#webui").val();
    // Different color for the active menu item
    var btnId = $("#active-menu-btn").val();
    if( btnId.length > 0) {
        $("#" + btnId).addClass("active");
    }
});

