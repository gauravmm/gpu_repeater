"use strict"

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
    $("body").removeClass("ajax-error");
    updated();

    var fragment = $("<div></div>");
    for (let key in data) {
        let gpus = data[key][0];
        let updated_time = null;
        if (data[key][1])
            updated_time = Date.parse(data[key][1]);

        let art = $("<article class='server-data'></article>");

        art.append($("<header></header>")
            .append($("<span></span>").text(timeSince(updated_time)))
            .append($("<h2></h2>").text(filterServerName(key))))

        let gpulist = ""
        if (typeof gpus == "string") {
            gpulist = $("<span class='server-error'></span>").text(gpus);

        } else {
            gpulist = $("<ul class='gpu-list'></ul>")

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
        }

        art.append(gpulist);

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

$("#toggle-view").click(() => $(document.body).toggleClass("view-summary"));

// Kick off loading
$(getUpdate);
