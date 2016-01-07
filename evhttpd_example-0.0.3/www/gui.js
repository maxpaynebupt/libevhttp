// WARNING: This code contains bugs and ugly hacks.  Many parts of it should
// be redesigned and rewritten from scratch.
//
// TO DO list:
//
// - There is a lot of dead code inherited from the old demo that
//   should be removed or refactored. (-> in progress)
//
// - The communication with the server should not poll constantly on
//   multiple connections but instead should use a better protocol
//   that does not require so much polling.  Depending on what the
//   browser and server support, this could be Websockets, SSE
//   (server-sent events) or comet requests.
//

// Types of events
// Note: These constants should be synchronized with the server side
var CONSOLE_DEBUG           = 0;
var CONSOLE_INFO            = 1;
var CONSOLE_ERROR           = 2;
var CONSOLE_SDEBUG          = 10;
var CONSOLE_SINFO           = 11;
var CONSOLE_SERROR          = 12;
var CONSOLE_XSENT           = 20;
var CONSOLE_XRECV           = 21;
var EVENT_NE_DEPLOY         = 40;
var EVENT_NE_DEPLOY_DONE    = 41;
var EVENT_NE_DEPLOY_FAIL    = 42;
var EVENT_NE_DESTROY        = 43;
var EVENT_NE_DESTROY_DONE   = 44;
var EVENT_NE_DESTROY_FAIL   = 45;
var EVENT_NE_UPDATED_INV    = 46;
var EVENT_VM_ADD            = 50;
var EVENT_VM_DEL            = 51;
var EVENT_VM_CHANGED        = 52;
var EVENT_NE_SCALE_OUT      = 60;
var EVENT_NE_SCALE_OUT_DONE = 61;
var EVENT_NE_SCALE_OUT_FAIL = 62;
var EVENT_NE_SCALE_IN       = 63;
var EVENT_NE_SCALE_IN_DONE  = 64;
var EVENT_NE_SCALE_IN_FAIL  = 65;
var EVENT_LOAD_INC          = 70;
var EVENT_LOAD_INC_DONE     = 71;
var EVENT_LOAD_DEC          = 72;
var EVENT_LOAD_DEC_DONE     = 73;

// Status of a network element
// Note: These constants should be synchronized with the server side
var STATUS_UNKNOWN          = 0;
var STATUS_READY            = 1;
var STATUS_UPDATING         = 2;
var STATUS_DESTROYING       = 3;
var STATUS_SCALING_OUT      = 4;
var STATUS_SCALING_IN       = 5;

var STATUS_LAST = STATUS_SCALING_IN;
var STATUS_NAMES = [
    'unknown',
    'ready',
    'updating <img src="images/loading-2circles-16x8-00285f-8d92b4-c3c5c9.gif" />',
    'destroying <img src="images/loading-2circles-16x8-00285f-8d92b4-c3c5c9.gif" />',
    'scaling out <img src="images/loading-2circles-16x8-00285f-8d92b4-c3c5c9.gif" />',
    'scaling in <img src="images/loading-2circles-16x8-00285f-8d92b4-c3c5c9.gif" />',
];

// Scaling mode flags of a network element
// Note: These constants should be synchronized with the server side
var SCALING_NONE    = 0;
var SCALING_MANUAL  = (1 << 0);
var SCALING_LOAD    = (1 << 1);
var SCALING_CONFIRM = (1 << 2);
var SCALING_TIME    = (1 << 3);

// Constants for the types of network elements and VMs
// Note: These constants should be synchronized with the server side
var NE_UNKNOWN       = "unknown";
var NE_TSP_CSCF      = "TSP.CSCF";
var VM_TSP_CSCF_IO   = "TSP.CSCF.io";
var VM_TSP_CSCF_LOAD = "TSP.CSCF.ld";
var VM_TSP_CSCF_OAM  = "TSP.CSCF.om";
var VM_TSP_CSCF_TP   = "TSP.CSCF.tp";
var NE_TSP_MTAS      = "TSP.MTAS";
var VM_TSP_MTAS_IO   = "TSP.MTAS.io";
var VM_TSP_MTAS_LOAD = "TSP.MTAS.ld";
var VM_TSP_MTAS_OAM  = "TSP.MTAS.om";
var VM_TSP_MTAS_TP   = "TSP.MTAS.tp";
var NE_CBA_CSCF      = "CBA.CSCF";
var VM_CBA_CSCF_SC   = "CBA.CSCF.sc";
var VM_CBA_CSCF_PL   = "CBA.CSCF.pl";
var NE_CBA_MTAS      = "CBA.MTAS";
var VM_CBA_MTAS_SC   = "CBA.MTAS.sc";
var VM_CBA_MTAS_PL   = "CBA.MTAS.pl";
var NE_LAPZ_MSC      = "LAPZ.MSC";
var VM_LAPZ_MSC_APG  = "LAPZ.MSC.apg";
var VM_LAPZ_MSC_VMP  = "LAPZ.MSC.vmproxy";
var VM_LAPZ_MSC_CP   = "LAPZ.MSC.cp";
var NE_SEA_MSC       = "LAPZ.MSC";
var VM_SEA_MSC_APG   = "LAPZ.MSC.apg";
var VM_SEA_MSC_VMP   = "LAPZ.MSC.vmproxy";
var VM_SEA_MSC_CP    = "LAPZ.MSC.cp";
var NE_TITANSIM      = "titansim";
var NE_MGWSIM        = "mgwsim";

// Global events stored as a special node
var GLOBAL_EVENT            = '*';

// Unique ID of the server we are talking to, to detect server restarts
var server_id = '0';

// Information about all known network elements and virtual machines
var nodes = {};           // internal database of nodes
var nodes_owner = null;   // operator name
var nodes_updated = 0;    // timestamp of last structural update
var nodes_redraw = true;  // do we need to redisplay the list of nodes?
var nodes_monitored = []; // list of names of nodes that we want to monitor
var tmp_monitor = ""; // FIXME: temporary
var load_redraw = true;   // TODO: clarify this

// Internal timer for periodic update loop
var update_timer = null;
//var timer_test = 3; // TEMPORARY
var updates_failed = 0;

// MSC load (FIXME: this should be replaced by something more generic)
var oldLoadData = [];
var oldMaxPoints = 1800;
var oldLoadDataStart = 0;
var oldPlot;
var oldLowLoad = 25;
var oldHighLoad = 70;
var oldLoadUpdateInterval = 1000;
var oldLoadGraphPeriod = 20;

var loadGraph;

// ----------------------------------------------------------------------------
// Firebug console or native browser console
// ----------------------------------------------------------------------------

function consoleLog() {
    if (typeof(console) == 'object' && typeof(console["log"]) != "undefined") {
        console.log.apply(console, arguments);
    }
}

function consoleWarn() {
    if (typeof(console) == 'object' && typeof(console["warn"]) != "undefined") {
        console.warn.apply(console, arguments);
    }
}

// ----------------------------------------------------------------------------
// Misc utility functions
// ----------------------------------------------------------------------------

// TODO: the new JQuery UI 1.9.x or 2.x provides a similar function
var uniqueId = 1;
function newUniqueId() {
    return uniqueId++;
}

// Return an associative array with the GET parameters of the supplied URL,
// or the URL of the current page if no parameter is passed.
function getUrlParams(url) {
    var params = {};
    if (typeof url == "undefined") {
        url = window.location.href;
    }
    var parts = url.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
        params[key] = decodeURIComponent(value);
    });
    return params;
}

// Binary search in a sorted array with timestamps : [[t1, ...], [t2, ...], ...]
// Return the index of the first element with a timestamp > t, or null if the
// array does not contain anything newer.
function bsearchT(t, arr) {
    var first = 0;
    var last  = arr.length - 1;
    if (last < 0 || arr[last][0] <= t) {
        return null;
    }
    if (arr[first][0] > t) {
        return first;
    }
    while (first < last) {
        var mid = Math.floor((first + last) / 2);
        if (arr[mid][0] <= t) {
            first = mid + 1;
            if (arr[first][0] > t) {
                return first;
            }
        } else {
            last = mid;
        }
    }
    return first;
}

// Concatenate or merge two sorted arrays with timestamps.  In most cases, it
// should be a simple concatenation.
// Return the merged array
function concatT(old_array, new_array) {
    if (old_array.length <= 0) {
        return new_array;
    }
    if (new_array.length <= 0) {
        return old_array;
    }
    if (old_array[old_array.length - 1][0] < new_array[0][0]) {
        return old_array.concat(new_array);
    }
    var i = bsearchT(new_array[0][0], old_array);
    if (i == null) {
        i = old_array.length - 1;
        while ((i > 0) && (old_array[i - 1][0] == new_array[0][0])) {
            i--;
        }
    }
    // clone the old array because we will be modifying it with splice()
    var merged_array = old_array.slice(0);
    for (var n = 0; n < new_array.length; n++) {
        while ((i < merged_array.length)
               && (merged_array[i][0] <= new_array[n][0])) {
            while (merged_array[i][0] == new_array[n][0]) {
//                consoleLog("skipping duplicate element ", i, n);
                n++;
                if (n >= new_array.length) {
//                    consoleLog("returning early, duplicates");
                    return merged_array;
                }
            }
            i++;
        }
        if (i == merged_array.length) {
//            consoleLog("returning now");
            while ((n < new_array.length)
                   && (merged_array[i - 1][0] == new_array[n][0])) {
                n++;
            }
            if (n < new_array.length) {
                return merged_array.concat(new_array.slice(n));
            } else {
                return merged_array;
            }
        }
//        consoleLog("inserting element", n, "at", i, "(", new_array[n], ")");
        merged_array.splice(i, 0, new_array[n]);
        i++;
    }
//    consoleLog("returning merged array");
    return merged_array;
}

// ----------------------------------------------------------------------------
// Inventory handling - managing the database of network elements (nodes)
// ----------------------------------------------------------------------------

function node_new(new_node_id) {
    if (new_node_id in nodes) {
        consoleWarn("Trying to add already existing node '" + new_node_id
                    + "'.");
        return;
    }
    consoleLog("Adding new node: '" + new_node_id + "'.");
    nodes[new_node_id] = {
        events: [],
        load: [],
        state: {
            updated: 0,
            owner: null,
        },
        vms: {},
    };
    // monitor that new node once
    nodes_monitored.push('&,' + new_node_id);
    nodes_redraw = true;
}

function node_destroy(old_node_id) {
    consoleLog("Deleting old node: '" + old_node_id + "'.");
    delete nodes[old_node_id];
    nodes_redraw = true;
}

function node_add_vm(node_id, new_vm_name) {
    if (! (node_id in nodes)) {
        consoleWarn("Trying to add VM '" + new_vm_name
                    + "' to non-existing node '" + node_id + "'.");
        return;
    }
    if (new_vm_name in nodes[node_id].vms) {
        consoleWarn("Trying to add already existing VM '" + new_vm_name
                    + "' to node '" + new_node_id + "'.");
        return;
    }
    consoleLog("Adding new VM: '" + new_vm_name + "' to node: '" + node_id
               + "'.");
    nodes[node_id].vms[new_vm_name] = {
        type: null,
        status: null,
        events: [],
        load: [],
    };
    nodes_redraw = true;
}

function node_del_vm(node_id, old_vm_name) {
    if (! (node_id in nodes)) {
        consoleWarn("Trying to renomve VM '" + new_vm_name
                    + "' from non-existing node '" + node_id + "'.");
        return;
    }
    consoleLog("Deleting old VM: '" + old_vm_name + "' from node: '"
               + node_id + "'.");
    delete nodes[node_id].vms[old_vm_name];
    nodes_redraw = true;
}

function node_status_name(status) {
    if ((status >= 0) && (status <= STATUS_LAST)) {
        return STATUS_NAMES[status];
    } else {
        return '?';
    }
}

// ----------------------------------------------------------------------------
// Display - Console window
// ----------------------------------------------------------------------------

var autoScroll = true;
var sent_regexp = null;
var sent_msg_len = 0;

function formatTime(timestamp) {
    timestamp = Math.round(timestamp) % (3600 * 24);
    var h = Math.floor(timestamp / 3600);
    var m = Math.floor((timestamp % 3600) / 60);
    return ''
        + ' ' + (h <= 9 ? '0' + h : h)
        + ':' + (m <= 9 ? '0' + m : m);
}

function formatTimeDate(timestamp) {
    var date;
    if (timestamp) {
        date = new Date(+timestamp);
    } else {
        date = new Date();
    }
    var d = date.getDate();
    var mo = date.getMonth() + 1;
    var y = date.getFullYear();
    var h = date.getHours();
    var m = date.getMinutes();
    var s = date.getSeconds();
    return '' + y
        + '-' + (mo <= 9 ? '0' + mo : mo)
        + '-' + (d <= 9 ? '0' + d : d)
        + ' ' + (h <= 9 ? '0' + h : h)
        + ':' + (m <= 9 ? '0' + m : m)
        + ':' + (s <= 9 ? '0' + s : s);
}

function convertTime(timestr) {
    var a = timestr.split(':', 2);
    var h = parseInt(a[0]);
    var m = parseInt(a[1]);
    var s = 0;
    if (a.length > 2) {
        s = parseInt(a[2]);
    }
    if (m < 0) {
        m = 0;
    }
    if (m > 59) {
        m = 59;
    }
    if (h < 0) {
        h = 0;
        m = 0;
    }
    if (h > 23) {
        h = 23;
        m = 59;
    }
    return (h * 60 + m) * 60 + s;
}

function validateTime(timestr) {
    return formatTime(convertTime(timestr));
}

function consoleAddMessage(console_id, type, message, timestamp, node_name) {
//    if (type >= CONSOLE_XRECV) {
//        return;
//    }
    var ts_prefix = "";
    var ts_postfix = "";
    if ((type != CONSOLE_XSENT) && (type != CONSOLE_XRECV)) {
        ts_prefix = formatTimeDate(timestamp) + " - ";
        ts_postfix = "\n";
    }
    var css = "console_error";
    switch(type) {
    case CONSOLE_DEBUG:
	css = "console_debug";
	break;
    case CONSOLE_INFO:
	css = "console_info";
	break;
    case CONSOLE_ERROR:
	css = "console_error";
	break;
    case CONSOLE_SDEBUG:
	css = "console_sdebug";
	break;
    case CONSOLE_SINFO:
	css = "console_sinfo";
	break;
    case CONSOLE_SERROR:
	css = "console_serror";
	break;
    case CONSOLE_XSENT:
	// do not display what we sent, but try to find it in the next output
	var last_msg_sent = message.split('\r')[0];
	//consoleLog('Sent: "' + last_msg_sent + '"');
	if (last_msg_sent.length > 2) {
	    try {
		var safe_re = last_msg_sent.replace(/[-\[\]{}()*+?.\\^$|#]/g,
						    "\\$&");
		sent_regexp = new RegExp(safe_re, 'i');
		sent_msg_len = last_msg_sent.length;
	    } catch (err) {
		consoleLog('Regexp error: ', err);
		sent_regexp = null;
	    }
	}
	// css = "console_xsent";
	return;
    case CONSOLE_XRECV:
	css = "console_xrecv";
	if (sent_regexp != null && sent_regexp.test(message)) {
	    //consoleLog('Match FOUND in ', message);
	    var res = sent_regexp.exec(message);
	    var msg_before = message.slice(0, res.index);
	    var msg_match = message.slice(res.index, res.index + sent_msg_len);
	    var msg_after = message.slice(res.index + sent_msg_len);
	    //consoleLog('BEFORE: "', msg_before, '"');
	    //consoleLog('MATCH: "', msg_match, '"');
	    //consoleLog('AFTER: "', msg_after, '"');
	    if (msg_before && msg_before.length > 0) {
		$('<span class="console_xrecv">').text(msg_before).appendTo(console_id);
	    }
	    $('<span class="console_xsent">').text(msg_match).appendTo(console_id);
	    if (msg_after && msg_after.length > 0) {
		$('<span class="console_xrecv">').text(msg_after).appendTo(console_id);
	    }
	    sent_regexp = null;
	    return;
	}
	break;
    case EVENT_NE_DEPLOY:
        message = 'Deploying new network element (' + message + ').';
	css = "console_info";
	break;
    case EVENT_NE_DESTROY:
        message = 'Removed network element (' + message + ').';
	css = "console_info";
	break;
    case EVENT_VM_ADD:
        message = 'Added new virtual machine "' + message + '" to '
            + node_name + '.';
	css = "console_debug";
	break;
    case EVENT_VM_DEL:
        message = 'Removed virtual machine "' + message + '" from '
            + node_name + '.';
	css = "console_debug";
	break;
    case EVENT_VM_CHANGED:
        message = 'Status changed for virtual machine "' + message + '" of '
            + node_name + '.';
	css = "console_debug";
	break;
    case EVENT_NE_SCALE_OUT:
        message = 'Scaling out ' + node_name + ' - starting.';
	css = "console_info";
	break;
    case EVENT_NE_SCALE_OUT_DONE:
        message = 'Scaling out ' + node_name + ' - completed.';
	css = "console_info";
	break;
    case EVENT_NE_SCALE_OUT_FAIL:
        message = 'Scaling out ' + node_name + ' - failed.';
	css = "console_error";
	break;
    case EVENT_NE_SCALE_IN:
        message = 'Scaling in ' + node_name + ' - starting.';
	css = "console_info";
	break;
    case EVENT_NE_SCALE_IN_DONE:
        message = 'Scaling in ' + node_name + ' - completed.';
	css = "console_info";
	break;
    case EVENT_NE_SCALE_IN_FAIL:
        message = 'Scaling in ' + node_name + ' - failed.';
	css = "console_error";
	break;
    default:
        return;
    }
    $('<span class="' + css + '">').text(ts_prefix + message + ts_postfix)
        .appendTo(console_id);
    //$(console_id).append('<span class="' + css + '">' + message + '</span>');
}

function consoleClear(console_id) {
    $(console_id).html('');
}

function consoleScroll(console_id) {
    if (autoScroll) {
	$(console_id).parent().parent().animate({scrollTop: $(console_id).height()},
				       800);
    }
}

// ----------------------------------------------------------------------------
// Display - Left sidebar with list of network elements and VMs
// ----------------------------------------------------------------------------

// obj can be any object with the fields ._html_id and ._expanded
function appendExpandableItem(selector, obj, extraCss, htmlHeader, htmlContent) {
    var liCss = "expandable";
    if (extraCss) {
	liCss += " " + extraCss;
    }
    $(selector).append("<li class=\"" + liCss + "\" id=\"" + obj._html_id
		       + "\">"
		       + "<div class=\"exphead\">" + htmlHeader + "</div>"
		       + "<div class=\"expcontent\">" + htmlContent + "</div>"
		       + "</li>\n");
    if (obj._expanded) {
	$("#" + obj._html_id).addClass("expanded");;
    } else {
	$("#" + obj._html_id + " .expcontent").hide();
	obj._expanded = false;
    }
    $("#" + obj._html_id + " .expander").toggle(function(_obj) {
	    return function() {
		$("#" + _obj._html_id + " .expcontent").show("fast");
	        $("#" + _obj._html_id).addClass("expanded");;
	        $("#" + _obj._html_id + " .expander").removeClass("ui-icon-circle-triangle-s");;
	        $("#" + _obj._html_id + " .expander").removeClass("ui-icon-minus");;
	        $("#" + _obj._html_id + " .expander").addClass("ui-icon-circle-triangle-n");;
		_obj._expanded = true;
	    };
	}(obj), function(_obj) {
	    return function () {
		$("#" + _obj._html_id + " .expcontent").hide("fast");
	        $("#" + _obj._html_id).removeClass("expanded");
	        $("#" + _obj._html_id + " .expander").removeClass("ui-icon-circle-triangle-n");;
	        $("#" + _obj._html_id + " .expander").removeClass("ui-icon-minus");;
	        $("#" + _obj._html_id + " .expander").addClass("ui-icon-circle-triangle-s");;
		_obj._expanded = false;
	    };
	}(obj));
}

function displayNodes(selector) {
    consoleLog("Displaying nodes:", nodes);
    $(selector).html('<ul class="nodes"></ul><div id="rescanbutton"></div><div id="testbutton"></div>');
    for (node_id in nodes) {
        if (node_id == GLOBAL_EVENT)
            continue;
	if (! nodes[node_id]._html_id) {
	    nodes[node_id]._html_id = "ne" + newUniqueId();
	}
	if (! nodes[node_id]._expanded) {
	    nodes[node_id]._expanded = false;
	}
        var node_name = node_id;
        var node_type = '<i>updating...</i>';
        var node_status = '<i>updating...</i>';
        if ("state" in nodes[node_id]) {
            if ("name" in nodes[node_id].state) {
                node_name = nodes[node_id].state.name;
            }
            if ("type" in nodes[node_id].state) {
                node_type = nodes[node_id].state.type;
            }
            if ("status" in nodes[node_id].state) {
                node_status = node_status_name(nodes[node_id].state.status);
            }
        }
	appendExpandableItem(selector + " .nodes", nodes[node_id], '',
			     '<b>' + node_name + '</b><br />Type: ' + node_type + '<br />Status: ' + node_status + '<span class="expander ui-icon ui-icon-minus" style="float: right; margin-left: 5px;"></span>',
			     '<ul class="vms"></ul>');
        $('#' + nodes[node_id]._html_id).click(function(_node_id) {
            return function() {
                tmp_monitor = _node_id;
                var _mon_str = _node_id;
                for (var _vm_name in nodes[_node_id].vms) {
	            var _vm = nodes[_node_id].vms[_vm_name];
                    if (_vm.type == VM_TSP_CSCF_TP
                        || _vm.type == VM_TSP_MTAS_TP
                        || _vm.type == VM_CBA_CSCF_PL
                        || _vm.type == VM_CBA_MTAS_PL
                        || _vm.type == VM_LAPZ_MSC_CP
                        || _vm.type == VM_SEA_MSC_CP) {
                        _mon_str += ',' + _vm_name;
                    }
                }
                nodes_monitored = [ _mon_str ];
                displayTabsForNode(_node_id);
            }
        }(node_id));
        if ("vms" in nodes[node_id]) {
            var has_vms = false;
            for (var vm_name in nodes[node_id].vms) {
	        var vm = nodes[node_id].vms[vm_name];
	        if (! vm._html_id) {
	            vm._html_id = "vm" + newUniqueId();
	        }
	        if (! vm._expanded) {
	            vm._expanded = true;
	        }
                var status_text = "?";
	        if ("status" in vm) {
	            status_text = vm.status;
	        }
	        if (("proc_status" in vm) && vm.proc_status) {
	            status_text += ' / ' + vm.proc_status;
	        }
	        appendExpandableItem('#' + nodes[node_id]._html_id + " .vms", vm, '',
			             '<span class="ui-icon ui-icon-gear" style="float: left; margin-right: 5px;"></span>' + vm_name,
			             '<span class="vminfo">' + status_text + '</span>');
                has_vms = true;
            }
            if (has_vms) {
	        $("#" + nodes[node_id]._html_id + " .expander").removeClass("ui-icon-minus");;
	        $("#" + nodes[node_id]._html_id + " .expander").addClass("ui-icon-circle-triangle-s");;
            }
        }
    }
    $("#rescanbutton").button({icons: {primary: 'ui-icon-refresh'},
		               label: "Rescan all"})
	.click(function() {
            var query_string = "";
            for (var node_id in nodes) {
                if (node_id != GLOBAL_EVENT) {
                    query_string += '&re=' + node_id;
                }
            }
            consoleAddMessage("#console1", CONSOLE_DEBUG,
                              'TEST: Rescan nodes (' + query_string + ').');
            queryServer(query_string);
	});
    $("#testbutton").button({icons: {primary: 'ui-icon-refresh'},
		             label: "Test"})
	.click(function() {
            var query_string = "";
            for (var node_id in nodes) {
                if (node_id != GLOBAL_EVENT) {
                    var state_time = 0;
                    if (nodes[node_id].state
                        && nodes[node_id].state.updated > 0) {
                        state_time = nodes[node_id].state.updated;
                    }
                    query_string += '&ns=' + node_id + ',-,-,' + state_time;
                }
            }
            consoleAddMessage("#console1", CONSOLE_DEBUG,
                              'TEST: Update node status (' + query_string + ').');
            queryServer(query_string);
        });
}

// ----------------------------------------------------------------------------
// Display - Tabs (settings, load graph, other)
// ----------------------------------------------------------------------------

function inputCheck(boolvar, idname) {
    return boolvar
        ? '<input type="checkbox" id="' + idname + '" value="' + idname + '" checked="checked"/>'
        : '<input type="checkbox" id="' + idname + '" value="' + idname + '"/>';
}

var THRESHOLD_GAP = 10;

function displayTabsForNode(node_id) {
    if (! node_id) {
        var placeholder
            = '<p>Please select a network element to be displayed here.</p>';
        $("#node-info").html(placeholder);
        $("#node-load").html(placeholder);
        $("#node-other").html(placeholder);
        return;
    }
    if (! (node_id in nodes)) {
        consoleWarn("Cannot display invalid node:", node_id);
        return;
    }
    var node_name = node_id;
    var scale_load = 0;
    var scale_time = 0;
    var scale_confirm = 0;
    var low_threshold = 0;
    var high_threshold = 100;
    var hard_min_tp = 2;
    var hard_max_tp = 4;
    var time_schedule = [{ timestamp: 0, min: 2, max: 4 }];
    if ("state" in nodes[node_id]) {
        if ("name" in nodes[node_id].state) {
            node_name = nodes[node_id].state.name;
        }
        if ("scaling_mode" in nodes[node_id].state) {
            scale_load = nodes[node_id].state.scaling_mode & SCALING_LOAD;
            scale_time = nodes[node_id].state.scaling_mode & SCALING_TIME;
            scale_confirm = nodes[node_id].state.scaling_mode & SCALING_CONFIRM;
        }
        if ("low_threshold" in nodes[node_id].state) {
            low_threshold = nodes[node_id].state.low_threshold;
        }
        if ("high_threshold" in nodes[node_id].state) {
            high_threshold = nodes[node_id].state.high_threshold;
        }
        if ("hard_min_tp" in nodes[node_id].state) {
            hard_min_tp = nodes[node_id].state.hard_min_tp;
        }
        if ("hard_max_tp" in nodes[node_id].state) {
            hard_max_tp = nodes[node_id].state.hard_max_tp;
        }
        time_schedule = [{ timestamp: 0, min: hard_min_tp, max: hard_max_tp }];
        if ("time_schedule_tp" in nodes[node_id].state) {
            if (nodes[node_id].state.time_schedule_tp.length > 0) {
                time_schedule = nodes[node_id].state.time_schedule_tp;
            }
        }
    }
    //$("#node-info").html('<p><img src="images/loading-indic-16x16-00285f.gif"> Loading information for ' + node_name + '...</p><p>(temporarily disabled)</p>');
    var time_table = '';
    for (var i = 0; i < time_schedule.length; i++) {
        time_table += '<tr><td>' + formatTime(time_schedule[i].timestamp)
            + '</td><td>' + time_schedule[i].min
            + '</td><td>' + time_schedule[i].max
            + '</td></tr>\n';
    }
    time_table += '<tr><td></td><td></td><td></td></tr>\n';
    $("#node-info").html('\
<h2>Scaling control for ' + node_name + '</h2>\
<div id="scaleinbutton"></div>\
<div id="scaleoutbutton"></div>\
<hr \>\
<h2>Configuration</h2>\
<div class="applybutton"></div>\
<h3>Scaling mode</h3>\
' + inputCheck(scale_load, "scaleload") + ' based on current load<br />\
' + inputCheck(scale_time, "scaletime") + ' based on time<br />\
' + inputCheck(scale_confirm, "scaleconfirm") + ' request confirmation before executing<br />\
<h3>Scaling based on load</h3>\
High threshold: <input id="highload" type="text" value="' + high_threshold + '" style="text-align: right; width:2em"> % <div id="highloadslider"></div><br />\
Low threshold: <input id="lowload" type="text" value="' + low_threshold + '" style="text-align: right; width:2em"> % <div id="lowloadslider"></div><br />\
<h3>Scaling based on time</h3>\
<table>\
<thead><tr><th>Time</th><th>Min TPs</th><th>Max TPs</th></tr></thead>\
<tbody id="timetable">\
' + time_table + '\
</tbody></table>\
<div class="applybutton"></div>\
<hr \>\
');
    $("#scaleinbutton").button({icons: {primary: 'ui-icon-minusthick'},
		                label: "Scale In"})
	.click(function () {
            consoleAddMessage("#console1", CONSOLE_INFO,
                              'Requesting scale in for "' + node_name + '"');
            queryServer('&si=' + node_id);
        });
    $("#scaleoutbutton").button({icons: {primary: 'ui-icon-plusthick'},
		                 label: "Scale Out"})
	.click(function () {
            consoleAddMessage("#console1", CONSOLE_INFO,
                              'Requesting scale out for "' + node_name + '"');
            queryServer('&so=' + node_id);
        });
    $(".applybutton").button({icons: {primary: 'ui-icon-check'},
		              label: "Apply changes",
                              disabled: false })
	.click(function () {
            var th_high = parseInt($("#highload").val());
            var th_low = parseInt($("#lowload").val());
            var sc_mode = SCALING_NONE;
            if ($("#scaleload").is(":checked")) {
                sc_mode |= SCALING_LOAD;
            }
            if ($("#scaletime").is(":checked")) {
                sc_mode |= SCALING_TIME;
            }
            if ($("#scaleconfirm").is(":checked")) {
                sc_mode |= SCALING_CONFIRM;
            }
            var url = '&sc=' + node_id + ',' + sc_mode + ',' + th_low + ',' + th_high;
            $("#timetable td").each(function(index) {
                consoleLog('@@@@@@', index, ':', $(this).text());
                var value = $(this).text();
                if (value.indexOf('Click') < 0) {
                    if ((index % 3) == 0) {
                        value = convertTime(value);
                    }
                    url += ',' + value;
                }
            });
            consoleLog('@@@@@@@@@@ URL:', url);
            queryServer(url);
        });
    $("#highload").change(function () {
        var value = parseInt(this.value);
        if (value > 100) {
            value = 100;
            $("#highload").val(value);
        }
        var min = parseInt($("#lowload").val());
        if (value < min + THRESHOLD_GAP) {
            value = min + THRESHOLD_GAP;
            $("#highload").val(value);
        }
        $("#highloadslider").slider("value", value);
    });
    $("#highloadslider").slider({
        min: 0,
        max: 100,
        step: 1,
        value: high_threshold,
        slide: function (event, ui) {
            var value = ui.value;
            if (value > 100) {
                value = 100;
                $("#highloadslider").slider("value", value);
            }
            var min = parseInt($("#lowload").val());
            if (value < min + THRESHOLD_GAP) {
                value = min + THRESHOLD_GAP;
                $("#highloadslider").slider("value", value);
            }
            $("#highload").val(value);
        },
        stop: function (event, ui) {
            var value = ui.value;
            if (value > 100) {
                value = 100;
                $("#highloadslider").slider("value", value);
            }
            var min = parseInt($("#lowload").val());
            if (value < min + THRESHOLD_GAP) {
                value = min + THRESHOLD_GAP;
                $("#highloadslider").slider("value", value);
            }
            $("#highload").val(value);
        }});
    $("#lowload").change(function () {
        var value = parseInt(this.value);
        if (value < 0) {
            value = 0;
            $("#lowload").val(value);
        }
        var max = parseInt($("#highload").val());
        if (value > max - THRESHOLD_GAP) {
            value = max - THRESHOLD_GAP;
            $("#lowload").val(value);
        }
        $("#lowloadslider").slider("value", value);
    });
    $("#lowloadslider").slider({
        min: 0,
        max: 100,
        step: 1,
        value: low_threshold,
        slide: function (event, ui) {
            var value = ui.value;
            if (value < 0) {
                value = 0;
                $("#lowloadslider").slider("value", value);
            }
            var max = parseInt($("#highload").val());
            if (value > max - THRESHOLD_GAP) {
                value = max - THRESHOLD_GAP;
                $("#lowloadslider").slider("value", value);
            }
            $("#lowload").val(value);
        },
        stop: function (event, ui) {
            var value = ui.value;
            if (value < 0) {
                value = 0;
                $("#lowloadslider").slider("value", value);
            }
            var max = parseInt($("#highload").val());
            if (value > max - THRESHOLD_GAP) {
                value = max - THRESHOLD_GAP;
                $("#lowloadslider").slider("value", value);
            }
            $("#lowload").val(value);
        }});
    $("#timetable td").editable(function(value, settings) {
        consoleLog('@@@@', this, value, settings);
        return value;
    }, {
        type: 'text',
        submit: 'OK',
    });
    $("#node-load").html('\
<h2><b>' + node_name + ' load</b> as percentage of total capacity</h2>\
<table><tbody><tr><td><div id="loadgraph"><img src="images/loading-indic-16x16-00285f.gif"> Loading...</div></td><td id="loadtps"></td></tr></tbody></table>');
    displayLoadGraph(node_id);
    $("#node-other").html('<p>(temporarily disabled)</p>');

/*
      <p><img src="images/loading-indic-16x16-00285f.gif"> Loading...</p>

      <h2><b>[Node Name] Load</b> as percentage of total capacity</h2>
      <div id="loadgraph" style="width:850px;height:300px;"><img src="images/loading-indic-16x16-00285f.gif"> Loading...</div>
      <p>Update load every <input id="updateInterval" type="text" value="1000" style="text-align: right; width:5em"> milliseconds</p>
      <p>Display load for the last <input id="graphPeriod" type="text" value="10" style="text-align: right; width:2em"> minutes</p>
    </div>
    <div id="node-other">
      <p>Load generator <b>TitanSim 1</b>. Target load: <b><span id="titan1">250</span></b> calls per second. <span id="cmdpause1"></span> <span id="cmdrestart1"></span></p>
      <p>Load generator <b>TitanSim 2</b>. Target load: <b><span id="titan2">350</span></b> calls per second. <span id="cmdpause2"></span> <span id="cmdrestart2"></span></p>
*/
}

// ----------------------------------------------------------------------------
// Load graph
// ----------------------------------------------------------------------------

function add_tp_bar(percent) {
    var h_max = 270;
    if (percent >= 0) {
        var h_bot = h_max * percent / 100;
        var h_top = h_max - h_bot;
        return '<td class="tpwrap"><div class="tpbar"><div class="tpfilltop" style="height:' + h_top + 'px"></div><div class="tpfillbot" style="height:' + h_bot + 'px"></div></div><div class="tplabel">' + Math.round(percent) + '%</div></td>';
    } else {
        return '<td class="tpwrap"><div class="tpbar"><div class="tpfilloff" style="height:' + h_max + 'px"></div></div><div class="tplabel">off</div></td>';
    }
}

function graphShowTooltip(x, y, bgcolor, bordercolor, contents) {
    $("<div id='graphtooltip'>" + contents + "</div>").css({
	position: "absolute",
	display: "none",
	top: y + 5,
	left: x + 8,
	border: "1px solid " + bordercolor,
	"border-radius": "5px",
	"-moz-border-radius": "5px",
	"-webkit-border-radius": "5px",
	"-o-border-radius": "5px",
	padding: "2px",
	"background-color": bgcolor,
	opacity: 0.80
    }).appendTo("body").fadeIn(200);
}

var previousPoint = null; // global, used for tooltips
var tp_labels = []; // global, used for tooltips

function displayLoadGraph(node_id) {
    if (! (node_id in nodes)) {
        consoleWarn("Cannot display load graph for unknown node:", node_id);
        return;
    }
    load_redraw = false;
    var node_name = node_id;
    var low_threshold = 0;
    var high_threshold = 100;
    var max_tps = 4.999;
    if ("state" in nodes[node_id]) {
        if ("name" in nodes[node_id].state) {
            node_name = nodes[node_id].state.name;
        }
        if ("low_threshold" in nodes[node_id].state) {
            low_threshold = nodes[node_id].state.low_threshold;
        }
        if ("high_threshold" in nodes[node_id].state) {
            high_threshold = nodes[node_id].state.high_threshold;
        }
        if ("hard_max_tp" in nodes[node_id].state) {
            max_tps = +nodes[node_id].state.hard_max_tp + 0.999;
        }
    }
    var load_data = [];
    if ("load" in nodes[node_id]) {
        load_data = nodes[node_id].load;
    }
    var t1 = new Date().getTime(); // now
    var t0 = t1 - oldLoadGraphPeriod * 60 * 1000;  // default: -20 minutes

     // rdcchhb - check the received tp_data and load_data
     // consoleAddMessage("#console1", CONSOLE_INFO, '[rdcchhb] current time is "' +t1 + '"');

    // setup plot
    var colors = [ "#d1d2d4", "#89ba17", "#e32119", "#00a9d4", "#d1d2d4" ];
    var colorsbg = [ "#e1e2e3", "#d5e4af", "#f6b495", "#badeee", "#e1e2e3" ];
    var options = {
        series: { shadowSize: 0 },
	grid: { hoverable: true },
        xaxis: { min: t0,
		 max: t1,
		 mode: "time",
		 timezone: "browser" },
	yaxes: [ { min: 0,
		   max: 100,
		   color: "#00a9d4",
		   tickFormatter: function(v, axis) { return v + "% "; } },
		 { min: 0,
		   max: max_tps,
                   tickDecimals: 0,
		   position: "right",
		   color: "#b1b3b4" } ],
	legend: { position: 'nw',
		  sorted: true },
	colors: colors
    };
    var lowLine = [[t0, low_threshold], [t1, low_threshold]];
    var highLine = [[t0, high_threshold], [t1, high_threshold]];
    var tp_data = [];
    tp_labels = [];
    if ("events" in nodes[node_id]) {
        var num_tp = 0;
        for (var e = 0; e < nodes[node_id].events.length; e++) {
            var event_type = nodes[node_id].events[e][1];
            if ((   event_type >= EVENT_NE_SCALE_OUT
                 && event_type <= EVENT_NE_SCALE_IN_FAIL)
                || (event_type == EVENT_NE_UPDATED_INV)) {
                num_tp = nodes[node_id].events[e][2];
                var event_time = nodes[node_id].events[e][0]
                // protect against events happening exactly at the same time
                if ((tp_data.length == 0) || (tp_data[tp_data.length - 1][0]
                                              != event_time)) {
                    tp_data.push( [ event_time, num_tp ] );
                    if (event_type == EVENT_NE_SCALE_OUT) {
                        tp_labels.push("Scaling out");
                    } else if (event_type == EVENT_NE_SCALE_OUT_DONE) {
                        tp_labels.push("Finished scaling out");
                    } else if (event_type == EVENT_NE_SCALE_OUT_FAIL) {
                        tp_labels.push("Failed scaling");
                    } else if (event_type == EVENT_NE_SCALE_IN) {
                        tp_labels.push("Scaling in");
                    } else if (event_type == EVENT_NE_SCALE_IN_DONE) {
                        tp_labels.push("Finished scaling in");
                    } else if (event_type == EVENT_NE_SCALE_IN_FAIL) {
                        tp_labels.push("Failed scaling");
                    } else if (event_type == EVENT_NE_UPDATED_INV) {
                        tp_labels.push("Updated inventory");
                    } else {
                        tp_labels.push("");
                    }
                }
            }
        }
        // set a point in the future for the number of TPs
        if (num_tp > 0) {
            if (nodes[node_id].state.status == STATUS_SCALING_IN) {
                num_tp--;
            } else if (nodes[node_id].state.status == STATUS_SCALING_OUT) {
                num_tp++;
            }
            tp_data.push( [ t1 + 600 * 1000, num_tp ] );
        }
    }
    loadGraph = $.plot($("#loadgraph"),
                       [ { data: tp_data,
			   lines: { fill: true },
			   label: "Number of traffic processors",
			   yaxis: 2 },
			 lowLine,
			 highLine,
			 { data: load_data,
			   label: node_name + " load" },
		       ], options);
     // rdcchhb - check the received tp_data and load_data
     // consoleAddMessage("#console1", CONSOLE_INFO, '[rdcchhb] loadgraph subroutine. load_data is "' +load_data + '"');
     // consoleAddMessage("#console1", CONSOLE_INFO, '[rdcchhb] loadgraph subroutine. tp_data is "' +tp_data + '"');
     // consoleAddMessage("#console1", CONSOLE_INFO, '[rdcchhb] loadgraph subroutine. numb_tp is "' +num_tp + '"');

    /*
    var tx = (t0 + t1) / 2;
    var o = loadGraph.pointOffset( { x: tx, y: 1, yaxis: 2 } );
    var ctx = loadGraph.getCanvas().getContext("2d");
    ctx.beginPath();
    o.left += 4;
    ctx.moveTo(o.left, o.top);
    ctx.lineTo(o.left, o.top - 10);
    ctx.lineTo(o.left + 10, o.top - 5);
    ctx.lineTo(o.left, o.top);
    ctx.fillStyle = "#000";
    ctx.fill();
    */
    $("#loadgraph").bind("plothover", function (event, pos, item) {
	if (item) {
	    if (previousPoint != item.dataIndex) {
		
		previousPoint = item.dataIndex;
		
		$("#graphtooltip").remove();
		var d = new Date(item.datapoint[0]);
		var h = d.getHours();
		if (h < 10) { h = '0' + h; }
		var m = d.getMinutes();
		if (m < 10) { m = '0' + m; }
		var s = d.getSeconds();
		if (s < 10) { s = '0' + s; }
		var msg = "Time: " + h + ":" + m + ":" + s + "<br />";
		if (item.seriesIndex == 0) {
                    if ((item.dataIndex >= 0)
                        && (item.dataIndex <= tp_labels.length)
                        && tp_labels[item.dataIndex]) {
                        msg += tp_labels[item.dataIndex] + "<br />";
                    }
		    msg += "Number of TPs: <b>" + item.datapoint[1] + "</b>";
		} else if (item.seriesIndex == 1) {
		    msg = "Low threshold: <b>" + item.datapoint[1] + "%</b>";
		} else if (item.seriesIndex == 2) {
		    msg = "High threshold: <b>" + item.datapoint[1] + "%</b>";
		} else if (item.seriesIndex == 3) {
		    msg += node_name + " load: <b>" + item.datapoint[1].toFixed(2) + "%</b>";
		} else if (item.seriesIndex == 4) {
		    msg += "Event: ???";
		}
		graphShowTooltip(item.pageX, item.pageY,
				 colorsbg[item.seriesIndex],
				 colors[item.seriesIndex],
				 msg);
	    }
	} else {
	    $("#graphtooltip").remove();
	    previousPoint = null;            
	}
    });
    var tphtml = '<table><tbody><tr>';
    var sorted_vms = Object.keys(nodes[node_id].vms).sort();
    for (var i = 0; i < sorted_vms.length; i++) {
	var vm = nodes[node_id].vms[sorted_vms[i]];

     // rdcchhb - check the received tp_data and load_data
     //   consoleAddMessage("#console1", CONSOLE_INFO, '[rdcchhb] vm"'+i+'".status is "' +vm.status+ '"');


        if (vm.type == VM_TSP_CSCF_TP || vm.type == VM_TSP_MTAS_TP
            || vm.type == VM_CBA_CSCF_PL || vm.type == VM_CBA_MTAS_PL
            || vm.type == VM_LAPZ_MSC_CP || vm.type == VM_SEA_MSC_CP) {
            if (vm.status == "poweredOn") {
                if (("load" in vm) && (vm.load.length > 0)) {
                    tphtml += add_tp_bar(vm.load[vm.load.length - 1][1]);
                } else {
                    tphtml += add_tp_bar(0);
                }
            } else {
                tphtml += add_tp_bar(-1);
            }
        }
    }
    tphtml += '</tr></tbody></table>';
    $("#loadtps").html(tphtml);
}

// ----------------------------------------------------------------------------
// Communication with the server
// ----------------------------------------------------------------------------

function serverResponse(data) {
    if (data == null) {
	consoleAddMessage("#console1", CONSOLE_ERROR,
			  "Cannot communicate with server!");
	consoleWarn('Null server response');
        updates_failed++;
        return;
    }
    var timestamp = new Date().getTime();
    consoleLog("data =", data); // DEBUG
    if (data.id != server_id) {
	consoleClear("#console1");
	if (server_id != '0') {
	    consoleAddMessage("#console1", CONSOLE_INFO,
			      "Server restarted.");
	}
        server_id = data.id;
        nodes_updated = 0;
    }
    updates_failed = 0;
    for (var key in data) {
        if (key == "id") {
            // skip
        } else if (key == GLOBAL_EVENT) {
            consoleLog('Updating global events ', data[key]); // DEBUG
            nodes[key].events = concatT(nodes[key].events, data[key].events);
            for (var e in data[key].events) {
                consoleAddMessage("#console1",
                                  data[key].events[e][1],
                                  data[key].events[e][2],
                                  data[key].events[e][0]);
            }
        } else if (key == "nodes") {
            consoleLog('Updating list of nodes ', data.nodes); // DEBUG
            for (var n in data.nodes) {
                var node_id = data.nodes[n];
                if (! (node_id in nodes)) {
                    node_new(node_id);
                }
                nodes[node_id]._updated = timestamp;
            }
            for (var node_id in nodes) {
                if ((nodes[node_id]._updated != timestamp)
                    && (node_id != '*')) {
                    node_destroy(node_id);
                }
            }
        } else if (key == "nodes_t") {
            nodes_updated = data.nodes_t;
        } else {
            consoleLog('Updating node ' + key + ': ', data[key]); // DEBUG
            if (! data[key]) {
                // node does not exist (maybe already deleted by the code above)
                if (key in nodes) {
                    node_destroy(key);
                }
                continue;
            }
            if ("events" in data[key]) {
                nodes[key].events = concatT(nodes[key].events,
                                            data[key].events);
                var name = key;
                if (("state" in data[key]) && ("name" in data[key].state)) {
                    name = data[key].state.name;
                } else if ("name" in nodes[key].state) {
                    name = nodes[key].state.name;
                }
                for (var e in data[key].events) {
                    consoleAddMessage("#console1",
                                      data[key].events[e][1],
                                      data[key].events[e][2],
                                      data[key].events[e][0],
                                      key);
                }
            }
            if ("load" in data[key]) {
                nodes[key].load = concatT(nodes[key].load, data[key].load);
                if (key == tmp_monitor) {
                    load_redraw = true;
                }
            }
            if ("state" in data[key]) {
                nodes[key].state = data[key].state;
                nodes_redraw = true;
            }
            if ("vms" in data[key]) {
                for (var vm_name in data[key].vms) {
                    if (data[key].vms[vm_name]) {
                        if (! nodes[key].vms) {
                            nodes[key].vms = {};
                        }
                        if (! nodes[key].vms[vm_name]) {
                            node_add_vm(key, vm_name);
                        }
                        nodes[key].vms[vm_name].type
                            = data[key].vms[vm_name].type;
                        nodes[key].vms[vm_name].status
                            = data[key].vms[vm_name].status;
                        if ("events" in data[key].vms[vm_name]) {
                            nodes[key].vms[vm_name].events
                                = concatT(nodes[key].vms[vm_name].events,
                                          data[key].vms[vm_name].events);
                        }
                        if ("load" in data[key].vms[vm_name]) {
                            nodes[key].vms[vm_name].load
                                = concatT(nodes[key].vms[vm_name].load,
                                          data[key].vms[vm_name].load);
                            load_redraw = true;
                        }
                        if ("proc_status" in data[key].vms[vm_name]) {
                            nodes[key].vms[vm_name].proc_status
                                = nodes[key].vms[vm_name].proc_status;
                        }
                    } else {
                        if (nodes[key].vms && (vm_name in nodes[key].vms)) {
                            node_del_vm(key, vm_name);
                        }
                    }
                }
            }
        }
    }
    if (nodes_redraw) {
        nodes_redraw = false;
        displayNodes('#vmlist');
    }
    if (load_redraw && tmp_monitor) {
        displayLoadGraph(tmp_monitor);
    }
    consoleScroll("#console1");
}

function serverError(data) {
    consoleAddMessage("#console1", CONSOLE_ERROR,
		      "Cannot communicate with server!");
    updates_failed++;
    consoleLog("Consecutive AJAX failures:", updates_failed);
    if (updates_failed >= 10) {
        consoleAddMessage("#console1", CONSOLE_ERROR,
		          "Aborting automatic updates after 10 failures.");
        stopUpdates();
    }
    consoleScroll("#console1");
}

// Requests to the vapp-controller AJAX server.
//
// The option parameter 'nodes_params' will be added to the query string.
//
// The list of nodes to be monitored is in 'nodes_monitored'.  Each element of
// that list is a node_id, optionally followed by a comma-separated list of VMs
// to monitor for that node.  Prepending '&' to a node means that it should be
// removed after requesting the update once.
function queryServer(nodes_params) {
    //consoleLog("XXX nodes_params = ", nodes_params);
    if (! nodes_params) {
        nodes_params = "";
    }
    if (! nodes_owner) {
	consoleAddMessage("#console1", CONSOLE_ERROR,
                          "Missing operator name, cannot query server");
        return;
    }
    //consoleLog('AJAX init for nodes: ', nodes_monitored); // DEBUG
    //consoleLog('nodes = ', nodes); // DEBUG
    // Subscribe to the global events
    if (nodes[GLOBAL_EVENT].events && nodes[GLOBAL_EVENT].events.length > 0) {
        nodes_params += "&ns=" + GLOBAL_EVENT + ","
            + nodes[GLOBAL_EVENT].events.slice(-1)[0][0] + ",-,-";
    } else {
        nodes_params += "&ns=*,0,-,-";
    }
    // Subscribe to changes to specific nodes
    for (var i = 0; i < nodes_monitored.length; i++) {
        var vm_info = nodes_monitored[i].split(",");
        var node_id = vm_info[0];
        var temp_monitoring = false;
        if (node_id == '&') {
            vm_info.splice(0, 1);
            node_id = vm_info[0];
            temp_monitoring = true;
        }
        if (! (node_id in nodes)) {
            consoleWarn('Cannot monitor unknown node:', node_id);
            nodes_monitored.splice(i, 1);
            i--;
            continue;
        }
        consoleLog('nodes[' + node_id + '] = ', nodes[node_id]); // DEBUG
        var event_time = 0;
        if (temp_monitoring) {
            event_time = '-';
        } else if (nodes[node_id].events && nodes[node_id].events.length > 0) {
            event_time = nodes[node_id].events.slice(-1)[0][0];
        }
        var load_time = 0;
        if (temp_monitoring) {
            load_time = '-';
        } else if (nodes[node_id].load && nodes[node_id].load.length > 0) {
            load_time = nodes[node_id].load.slice(-1)[0][0];
        }
        var state_time = 0;
        if (nodes[node_id].state && nodes[node_id].state.updated > 0) {
            state_time = nodes[node_id].state.updated;
        }
        // Parameters: node_id, event_time, load_time, state_time
        nodes_params += "&ns=" + encodeURIComponent(node_id) + ","
            + event_time + "," + load_time + "," + state_time;
        // Now check if we have to monitor any VMs for that node
        var vm_list_changed = false;
        for (var j = 1; j < vm_info.length; j++) {
            var vm_name = vm_info[j];
            if (vm_name == '&') {
                vm_name = vm_info[j + 1];
                vm_info.splice(j, 2);
                j--;
                vm_list_changed = true;
            } else if (! (vm_name in nodes[node_id].vms)) {
                consoleWarn('Cannot monitor unknown VM:', vm_name,
                            'for node:', node_id);
                continue;
            }
            consoleLog('nodes[' + node_id + '].vms[' + vm_name + '] = ',
                       nodes[node_id].vms[vm_name]); // DEBUG
            if (nodes[node_id].vms[vm_name]) {
                var event_time = 0;
                if (nodes[node_id].vms[vm_name].events
                    && nodes[node_id].vms[vm_name].events.length > 0) {
                    event_time
                        = nodes[node_id].vms[vm_name].events.slice(-1)[0][0];
                }
                var load_time = 0;
                if (nodes[node_id].vms[vm_name].load
                    && nodes[node_id].vms[vm_name].load.length > 0) {
                    load_time
                        = nodes[node_id].vms[vm_name].load.slice(-1)[0][0];
                }
                // (node info) + vm_name, event_time, load_time
                nodes_params += "," + encodeURIComponent(vm_name)
                    + "," + event_time
                    + "," + load_time;
            }
        }
        // Check if the monitoring of this node was only temporary
        if (temp_monitoring) {
            nodes_monitored.splice(i, 1);
            i--;
        } else if (vm_list_changed) {
            consoleLog("@@@@@@@@@@@", nodes_monitored[i]); // DEBUG
            consoleLog("@@@@@@@@@@@", vm_info);            // DEBUG
            nodes_monitored[i] = vm_info.join(",");
            consoleLog("@@@@@@@@@@@", nodes_monitored[i]); // DEBUG
        }
    }
    //consoleLog('AJAX nodes_params: ', nodes_params); // DEBUG
    // Send the request to the server
    $.getJSON('ajax?id=' + server_id + "&on=" + nodes_owner + "&nt="
              + nodes_updated + nodes_params)
        .done(serverResponse)
        .fail(serverError);
    /*
    if (timer_test > 0) {
        timer_test--;
        consoleLog("----- Next automatic update in 5 seconds (" + timer_test
                   + " left).");
	consoleAddMessage("#console1", CONSOLE_DEBUG,
                          "TEST: Next update in 5 seconds.");
        setTimeout(queryServer, 5000, "");
    } else {
        consoleLog("----- End of automatic updates.");
	consoleAddMessage("#console1", CONSOLE_DEBUG,
                          "TEST: Stopping automatic updates.");
    }
    */
}

function scheduleUpdates(delay) {
    if (update_timer) {
	clearInterval(update_timer);
    }
    update_timer = setInterval(queryServer, delay, "");
}

function stopUpdates() {
    if (update_timer) {
	clearInterval(update_timer);
    }
    update_timer = null;
}

// ----------------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------------

function displayInit() {
    consoleLog("Initializing vapp-controller GUI");

    // Replace the whole page body
    $('body').html('\
<div class="ui-layout-center">\
  <div id="tabs">\
    <ul>\
      <li><a href="#node-info"><span>Info</span></a></li>\
      <li><a href="#node-load"><span>Load</span></a></li>\
      <li><a href="#node-other"><span>Other</span></a></li>\
    </ul>\
    <div id="node-info"></div>\
    <div id="node-load"></div>\
    <div id="node-other"></div>\
  </div>\
</div>\
<div class="ui-layout-west">\
  <div id="vmlist"></div>\
</div>\
<div class="ui-layout-south">\
  <div class="console-container">\
    <pre class="console" id="console1"><p>Console</p></pre>\
  </div>\
</div>\
<div id="dialog"></div>\
');
    // Tabs in the main pane
    $("#tabs").tabs({ active: 1 });
    $("#tabs").css({ 'padding': '0px',
		     'margin': '0px',
		     'background': 'none', 
		     'border-width': '0px',
		   });

    // Layout with 3 panes:
    // - center (main pane with tabs)
    // - west (list of VMs)
    // - south (console)
    var layout = $('body').layout({ applyDefaultStyles: true });
    $(".ui-layout-center").css('padding', '0px');
    layout.sizePane("south", 80);
    layout.sizePane("west", 240);

    // Fill the three panes with content
    displayNodes('#vmlist');
    displayTabsForNode(null);
    consoleClear('#console1');
}

// Main initialization function
$(function() {
    nodes_owner = getUrlParams()["owner"];
    //nodes_owner = "operator-001"; // UGLY HACK!
    nodes[GLOBAL_EVENT] = { events: [] };
    // Create the page layout
    displayInit();

    // Query the server once, then start the periodic updates
    setTimeout(queryServer, 1, "");
    // FIXME: test !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    consoleAddMessage("#console1", CONSOLE_DEBUG,
                      "TEST: Slow communication with server (1 sec delay).");
    scheduleUpdates(1000);
/* FIXME **********************************************************************
    var a1 = [[1,1], [2,2], [3,3], [4,4]];
    var a2 = [[5,5]];
    var a3 = [[2,2], [3,3], [4,4]];
    var a4 = [[2,2], [3,3], [4,4], [5,5]];
    var a5 = [[3,42]];
    var a6 = [[4,42]];
    var a7 = [[0,0]];
    consoleLog("a1:", a1);
    consoleLog(">>> a1+1:", concatT(a1, a1));
    consoleLog("a2:", a2);
    consoleLog(">>> a1+2:", concatT(a1, a2));
    consoleLog("a3:", a3);
    consoleLog(">>> a1+3:", concatT(a1, a3));
    consoleLog("a4:", a4);
    consoleLog(">>> a1+4:", concatT(a1, a4));
    consoleLog("a5:", a5);
    consoleLog(">>> a1+5:", concatT(a1, a5));
    consoleLog("a6:", a6);
    consoleLog(">>> a1+6:", concatT(a1, a6));
    consoleLog("a7:", a7);
    consoleLog(">>> a1+7:", concatT(a1, a7));
    consoleLog("a2:", a2);
    consoleLog(">>> a2+2:", concatT(a2, a2));
*/
});
