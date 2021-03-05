$(document).ready(function () {
    // Different color for the active menu item
    var btnId = $("#active-menu-btn").val();
    if( btnId.length > 0) {
        $("#" + btnId).addClass("active");
    }
});

