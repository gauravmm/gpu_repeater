// From: https://stackoverflow.com/a/3177838
function timeSince(date) {
    if (date === null)
        return "never";
    let seconds = Math.floor((new Date() - date) / 1000);
    return timeSinceSeconds(seconds);
}

function timeSinceMeta(base, modulus, string_gen) {
    return function (seconds) {
        let qty = Math.floor(seconds / base);
        if (modulus)
            qty = qty % modulus;

        if (qty == 0)
            return null;
        return string_gen(qty);
    }
}

var timeSinceFuncs = [
    timeSinceMeta(60*60*24*7, 0,  (x) => (x==1)? "a week":`${x} weeks`),
    timeSinceMeta(60*60*24,   7,  (x) => (x==1)?  "a day":`${x} days` ),
    timeSinceMeta(60*60,      24, (x) => (x==1)?"an hour":`${x} hours`),
    timeSinceMeta(60,         60, (x) => (x==1)?  "a min":`${x} minutes`),
    timeSinceMeta(1,          60, (x) => (x<=5)?  "just now":`${x} seconds`)];
// From: https://stackoverflow.com/a/3177838
function timeSinceSeconds(seconds) {
    let time_str = timeSinceFuncs.map((x) => x(seconds));

    // Remove leading empty strings:
    while ((time_str.length > 0) && (time_str[0] == null))
        time_str.shift();

    if (time_str.length == 0)
        return "just now";
    return time_str[0];
}

var _last_updated = null
function _updateTimeSince(){
    if(_last_updated) {
        $("#last-updated").text("Updated " + timeSince(_last_updated))
    } else {
        $("#last-updated").text("Never updated")
    }
}

function updated(){
    _last_updated = new Date();
}

$(document).ready(function() {
    setInterval(_updateTimeSince, 1000);
});
