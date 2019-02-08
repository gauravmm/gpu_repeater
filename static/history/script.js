"use strict"


function filterServerName(name) {
    return name.replace(".local", "");
}
function filterGPUName(v) {
    return v.substring(4, 6);
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

function updateUserColorMap(users) {
    // Recompute the user-color table
    let colors = randomColor({count: users.length, seed: "locuslab"});
    let css = users.map(function (username, i) {
        return `.job[data-uname="${username}"] { background: ${colors[i]} }`;
    }).join("\n");

    $("<style>").prop("type", "text/css").html(css).appendTo("head");
}

var _prev_date = ""
function renderDate(dt) {
    let date = `${dt.getMonth() + 1}/${dt.getDate()}`
    let time = `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`

    if (date != _prev_date) {
        _prev_date = date;
        return date;
    } else {
        if (dt.getMinutes() % 30 == 0)
            return time;
    }

    return "";
}

var job_selected = false;
var zip= rows=>rows[0].map((_,c)=>rows.map(row=>row[c]));
function render(data) {
    updated();
    console.log(data);
    $("body").removeClass("ajax-error");

    // Prepare colormap
    updateUserColorMap(data.users);

    var fragment = $("<table></table>").attr("cellspacing", 0).attr("cellpadding", 0);

    let gpu_order = [];
    let machine_header = $("<tr></tr>").addClass("header-machine").append("<th></th>");
    let gpu_header = $("<tr></tr>").addClass("header-gpu").append("<th></th>");

    let alt = false;
    for (let machine in data.gpus) {
        alt = !alt;

        let gpus = data.gpus[machine];
        let gpu_entry = $("<th></th>").text(filterServerName(machine));

        if (gpus.length == 0) {
            gpu_order.push(["", machine]);
            machine_header.append(gpu_entry.addClass("no-gpu"));
            gpu_header.append($("<th></th>").text("").addClass("no-gpu"));
        } else {
            machine_header.append(gpu_entry.attr("colspan", gpus.length).addClass(alt?"alternate-head":""));
            for (let gpu of gpus) {
                gpu_order.push([gpu, machine]);
                gpu_header.append($("<th></th>").text(filterGPUName(gpu)).addClass(alt?"alternate-head":""));
            }
        }
    }
    fragment.append($("<thead>").append(machine_header).append(gpu_header));

    let tbody = $("<tbody>");
    // Now we render the history:
    for (let entry of data.history.reverse()) {
        let row = $("<tr></tr>");
        let time = new Date(entry[0]);
        row.append($("<th></th>").text(renderDate(time)));

        let gpu_jobs = entry[1];
        for (let gpu_machine of gpu_order) {
            let [gpu, machine] = gpu_machine;

            let cell = $("<td></td>");
            let jobs = undefined;

            try {
                jobs = gpu_jobs[gpu];
            } catch(e) {
                if (! e instanceof TypeError)
                    console.log(e);
            }

            if(jobs == null) {
                cell.addClass("no-data");
            } else {
                for (let job of jobs) {
                    let uname = job[0];
                    let uuid = `u_${machine}_${job[1]}_${job[2]}`;
                    let frac = job[3];
                    let cmdstr = job[4];
                    let since = new Date(job[2] * 1000);

                    let jobelt = $("<div></div>").addClass("job").width(`${frac*100}%`);
                    jobelt.attr("data-frac", frac);
                    jobelt.attr("data-uuid", uuid);
                    jobelt.attr("data-uname", uname);
                    jobelt.attr("data-cmdstr", cmdstr);
                    jobelt.attr("data-since", since);
                    jobelt.attr("data-machine", machine);
                    cell.append(jobelt);
                }
            }

            row.append(cell);
        }

        tbody.append(row);
    }

    $('#main').empty().append(fragment.append(tbody));

    function updateJobUser(obj) {
        $("#detail-user").empty().append(`<span class='d-user'>${obj.data('uname')}</span>@<span class='d-machine'>${filterServerName(obj.data('machine'))}</span>`);
    }

    $(".job").click(function(evt) {
        let obj = $(this);
        $(document.body).addClass("suppress-job");
        $(".same-user").removeClass("same-user");
        $(".same-process").removeClass("same-process");
        $(`.job[data-uname='${obj.data('uname')}']`).addClass("same-user");
        $(`.job[data-uuid='${obj.data('uuid')}']`).addClass("same-process");

        updateJobUser(obj);
        $("#detail").empty().append([
            `<div><span class='d-cmd'>${obj.data('cmdstr')}</span></div>`,
            `<div>Since <span class='d-since'>${obj.data('since')}</span></div>`]);

        job_selected = true;
        return false;
    });

    $(".job").mouseover(function (e) {
        $("#proc-use").text(`${Math.round($(this).data('frac') * 1000)/10}%`);
        if (!job_selected)
            updateJobUser($(this));
    });

    $("#main table td").click(function(evt) {
        let obj = $(this);
        $(document.body).removeClass("suppress-job");
        $(".same-user").removeClass("same-user");
        $(".same-process").removeClass("same-process");
        $("#detail").empty();
        job_selected = false;
    });
}

function renderFailed() {
    $("body").addClass("ajax-error");
}

var TIMEOUT = 6 * 60 * 1000;

function getUpdate(){
    $.ajax({
        url: "https://loci.cs.cmu.edu/gpu/update/history",
        method: "GET",
        data: {}
    })
    .done(render)
    .fail(renderFailed)
    .always(function() {
        setTimeout(getUpdate, TIMEOUT);
    });
}

// Kick off loading
$(getUpdate);
