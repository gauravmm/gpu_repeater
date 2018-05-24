"use strict"

// From: https://stackoverflow.com/a/3177838
function timeSince(date) {
    let seconds = Math.floor((new Date() - date) / 1000);
    return timeSinceSeconds(seconds);
}

function timeSinceSeconds(seconds) {
    let hours = Math.floor(seconds / 3600);
    if (hours >= 1) {
        let hour_string = (hours == 1)?"an hour":(hours + " hours");
        let minutes = Math.round((seconds % 3600) / 60);
        if (minutes > 1) {
            return hour_string + " and " + minutes + " minutes ago";
        } else if (minutes == 1) {
            return hour_string + " and 1 minute ago";
        } else {
            return hour_string + " ago";
        }
    }
    if (seconds >= 90)
      return Math.round(seconds / 60) + " minutes ago";
    if (seconds >= 60)
        return "a minute ago";
    if (seconds > 5)
        return Math.floor(seconds) + " seconds ago";
    return "just now";
}

var last_updated = null
function updateTimeSince(){
    if(last_updated) {
        $("#last-updated").text("Updated " + timeSince(last_updated))
    } else {
        $("#last-updated").text("Never updated")
    }
}

function filterServerName(name) {
    return name.replace(".local", "");
}

function filterGPUName(v) {
    return v.substring(0, 12);
}
function filterPercentage(v) {
    return Math.round(v * 100) + "%";
}
function filterMiB(v) {
    if(v) {
        return Math.round(v/1024/1024) + " MiB";
    }
    return "None"
}

function filterCommandline(v) {
    return v.join(" ").trim();
}

function filterGPUProcesses(proc) {
    let elt = $("<li></li>");
    elt.append($("<span class=\"proc-mem\"></span>").text(filterMiB(proc["gpu_mem"])));
    elt.append($("<span class=\"proc-user\"></span>").text(proc["username"]));
    elt.append($("<span class=\"proc-since\"></span>").text(timeSince(proc["create_time"] * 1000)));
    elt.append($("<span class=\"proc-cmd\"></span>").text(proc["name"]).append(
        $("<span class='proc-cmd-toolip'></span>").text(filterCommandline(proc["cmdline"]))
    ));
    return elt;
}

function render(data) {
    last_updated = new Date();
    console.log(data);
    $("body").removeClass("ajax-error");

    var fragment = $("<div></div>");
    for (let key in data) {
        let gpus = data[key][0];
        let updated_time = Date.parse(data[key][1]);

        let art = $("<article class='server-data'></article>");

        if (updated_time == null) {
            art.append($("<header></header>")
                .append($("<h2></h2>").text(filterServerName(key)))
                .append($("<span></span>").text("never updated")))

        } else {
            art.append($("<header></header>")
                .append($("<span></span>").text(timeSince(updated_time)))
                .append($("<h2></h2>").text(filterServerName(key))))

            let gpulist = $("<ul class='gpu-list'></ul>")
            for (let gpu in gpus) {
                let gpu_data = gpus[gpu] 
                gpulist.append($("<li></li>")
                    .append($("<span class='mem-used'></span>").text(filterPercentage(gpu_data["gpu_mem"]["used"])))
                    .append($("<span class='proc-used'></span>").text(filterPercentage(gpu_data["gpu_util"]["gpu"])))
                    .append($("<h3></h3>").text(filterGPUName(gpu)))
                    .append($("<div class='mem-used-bar-outer'></div>")
                        .append($("<div class='mem-used-bar-inner'>&nbsp;</div>").css("width", gpu_data["gpu_mem"]["used"]*100 + "%")))
                    .append($("<ul class='processes'></ul>")
                        .append(gpu_data['gpu_procs'].map(filterGPUProcesses)))
                )
            }

            art.append(gpulist);
        }

        fragment.append(art);
    }

    $('#main').empty().append(fragment);
}

function renderFailed() {
    $("body").addClass("ajax-error")
}

var TIMEOUT = 60 * 1000;

function getUpdate(){
    $.ajax({
        url: "https://loci.cs.cmu.edu/gpu/update/",
        method: "GET",
        data: {}
    })
    .done(render)
    .fail(renderFailed)
    .always(function() {
        setTimeout(getUpdate, TIMEOUT);
    });
}

function init(){
    getUpdate();
    setInterval(updateTimeSince, 1000);
}

// Kick off loading
$(init)