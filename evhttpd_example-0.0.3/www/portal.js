// WARNING: This code contains bugs and ugly hacks.  Many parts of it should
// be redesigned and rewritten from scratch.
//
// - There is a lot of dead code inherited from the old demo that
//   should be removed or refactored.
//
// - The communication with the server (AJAX requests) should use a
//   better publish/subscribe mechanism using multiple event channels
//   instead of having separate connections for log and load info.
//
// - EVENT_NODES is a rather ugly hack.  See the previous point.
//
// - The communication with the server should not poll constantly on
//   multiple connections but instead should use a better protocol
//   that does not require so much polling.  Depending on what the
//   browser and server support, this could be Websockets, SSE
//   (server-sent events) or comet requests.
//
// - It should be possible to support multiple nodes and to have a
//   dynamic view of the network and the number of active nodes.  The
//   fixed data in the "db" array should be replaced by real
//   information fetched from the server.
//
// - It should be possible to click on any node in the left column and
//   to get the corresponding information in the load/info/other tabs.
//
// - The load information should not be fetched constantly but should
//   only be requested when the load tab is active.
//
// - The load graph would look better with a fixed time scale.


var CONSOLE_DEBUG  = 0;
var CONSOLE_INFO   = 1;
var CONSOLE_ERROR  = 2;
var CONSOLE_SDEBUG = 10;
var CONSOLE_SINFO  = 11;
var CONSOLE_SERROR = 12;
var CONSOLE_XSENT  = 20;
var CONSOLE_XRECV  = 21;
var EVENT_NODES    = 100;

// MSC info (FIXME: this should be replaced by something more generic)
var bladeData = [];
var currentBlades = {};
var activeBlades = 0;

// MSC load (FIXME: this should be replaced by something more generic)
var loadData = [];
var maxPoints = 1800;
var loadDataStart = 0;
var plot;
var lowLoad = 25;
var highLoad = 70;
var loadUpdateInterval = 1000;
var loadGraphPeriod = 20;

// FIXME: cached data should be replaced by real-time data from vCenter
// It should be fetched by AJAX requests to the management server (POE-based)
var db = [
           { name: "Operator-A.de",
             apps: [
                     { name: "vCUDB",
                       vms: [
                              { name: "cudb-01-router-001", },
                              { name: "cudb-01-router-002", },
                              { name: "SC_2_1", },
                              { name: "SC_2_2", },
                              { name: "PL_2_3", },
                              { name: "PL_2_4", },
                              { name: "PL_2_5", },
                              { name: "PL_2_6", },
                            ],
                     },
                     { name: "vHLR_FE_BS",
                       vms: [
                              { name: "vhlr-001-bc01", },
                              { name: "vhlr-001-bc02", },
                              { name: "vhlr-001-spx", },
                              { name: "vmsc-010-apg43a", },
                              { name: "vmsc-010-apg43b", },
                              { name: "vmsc-011-apg43a", },
                              { name: "vmsc-011-apg43b", },
                            ],
                     },
                     { name: "vims-002",
                       vms: [
                              { name: "vims-002-dns", },
                              { name: "vims-002-proc_m0_s1_io1", },
                              { name: "vims-002-proc_m0_s2_io2", },
                              { name: "vims-002-proc_m0_s3", },
                              { name: "vims-002-proc_m0_s4", },
                              { name: "vims-002-proc_m0_s5", },
                              { name: "vims-002-proc_m0_s6", },
                              { name: "vims-002-proc_m0_s7", },
                              { name: "vims-002-proc_m0_s8", },
                              { name: "vims-002-router", },
                            ],
                     },
                     { name: "vMSC-BC_02",
                       vms: [
                              { name: "vmsc-001-apg43a", },
                              { name: "vmsc-001-apg43b", },
                              { name: "vmsc02-bc00", },
                              { name: "vmsc02-bc01", },
                              { name: "vmsc02-bc02", },
                              { name: "vmsc02-bc03", },
                              { name: "vmsc02-spx", },
                            ],
                     },
                   ],
             misc: "Operator-A",
           },        
           { name: "Operator-A.nl",
             apps: [
                     { name: "vMSC-S-600",
                       vms: [
                              { name: "vmsc-002-apg43a", },
                              { name: "vmsc-002-apg43b", },
                              { name: "vmsc02-s00", },
                            ],
                     },
                   ],
             misc: "Operator-A",
           },        
           { name: "Operator-B.nl",
             apps: [
                     { name: "vIMS",
                       vms: [
                              { name: "Proc_m0_s1_io1", },
                              { name: "Proc_m0_s2_io2", },
                              { name: "Proc_m0_s3", },
                              { name: "Proc_m0_s4", },
                              { name: "Proc_m0_s5", },
                              { name: "Proc_m0_s6", },
                              { name: "Proc_m0_s7", },
                              { name: "Proc_m0_s8", },
                              { name: "vPGM_LE", },
                              { name: "iDNS_IPW7", },
                              { name: "HSS-CSCF_router", },
                              { name: "vims-001-dns", },
                            ],
                     },
                   ],
             misc: "Operator-B",
           },        
         ];

var xxx_vims = 
                     { name: "vIMS",
                       vms: [
                              { name: "Proc_m0_s1_io1", },
                              { name: "Proc_m0_s2_io2", },
                              { name: "Proc_m0_s3", },
                              { name: "Proc_m0_s4", },
                              { name: "Proc_m0_s5", },
                              { name: "Proc_m0_s6", },
                              { name: "Proc_m0_s7", },
                              { name: "Proc_m0_s8", },
                              { name: "router", },
                            ],
		     };

// ----------------------------------------------------------------------------

function consoleLog() {
    if (typeof(console) == 'object' && typeof(console["log"]) != "undefined") {
        console.log.apply(console, arguments);
    }
}

// TODO: the new JQuery UI 1.9.x provides a similar function
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
        params[key] = value;
    });
    return params;
}

// ----------------------------------------------------------------------------

var autoScroll = true;
var sent_regexp = null;
var sent_msg_len = 0;

function consoleAddMessage(console_id, type, message, timestamp) {
    if (! timestamp) {
	timestamp = new Date().getTime();
    }
    if (type == EVENT_NODES) {
	consoleLog("NEW NODES: ", message);
	// Special case when the configuration of the nodes has changed
	currentBlades = message;
	activeBlades = 0;
	for (var key in message) {
	    if (message.hasOwnProperty(key)) {
		consoleLog(timestamp, " - ", key, " = ", message[key]);
		if (message[key][1].indexOf("NORMAL") >= 0) {
		    activeBlades++;
		}
	    }
	}
	bladeData.push( [ timestamp, activeBlades ] );
	var maxSubs = activeBlades * 900000;
	var html = "<p>Currently active blades: " + activeBlades + "</p><p>Node capacity: approx. " + maxSubs + " subscribers.</p><p>Number of currently registered subscribers: 100000.</p>";
	$("#node-info").html(html);
	// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
	consoleLog("active blades: ", activeBlades);
	consoleLog("bladeData ", bladeData);
	return;
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
    }
    $('<span class="' + css + '">').text(message).appendTo(console_id);
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

var last_log_message = 0;
var last_server_id = '0';
var last_sent = '';
var server_mode = 0;
var update_timer = null;

var bc3_status = 'unknown';
var bc3_html_id = null;

function scheduleUpdates(delay) {
    if (update_timer) {
	clearInterval(update_timer);
    }
    update_timer = setInterval(doUpdates, delay);
}

function stopUpdates(delay) {
    if (update_timer) {
	clearInterval(update_timer);
    }
    update_timer = null;
}

function fetchLog() {
    var msg_type = 0;
    var msg_buf = '';
    var timestamp = 0;
    //consoleLog('JSON init');
    $.getJSON('log?start=' + last_log_message + '&id=' + last_server_id,
	      function(data) {
		  if (data == null) {
		      consoleAddMessage("#console1", CONSOLE_ERROR,
					"Cannot communicate with server!\n");
		      consoleLog('ERROR NULL');
		  } else {
		      consoleLog(data);
		      if (data.id != last_server_id) {
			  consoleClear("#console1");
			  if (last_server_id != '0') {
			      consoleAddMessage("#console1", CONSOLE_INFO,
						"Server restarted.\n");
			  }
			  last_server_id = data.id;
		      }
		      last_log_message = data.last;
		      server_mode = data.mode;
		      if (data.bc3) {
			  if (data.bc3 != bc3_status) {
			      bc3_status = data.bc3;
			      $("#bc3status").text(bc3_status);
			      if (bc3_html_id) {
				  if (bc3_status == "stopped") {
				      consoleLog("HIDING ", bc3_html_id);
				      $("#" + bc3_html_id).fadeOut("slow");
				      $("#" + bc3_html_id).removeClass("working");
				  } else if (bc3_status == "running") {
				      $("#" + bc3_html_id).fadeIn("fast");
				      $("#" + bc3_html_id).removeClass("working");
				  } else if (bc3_status == "recovery") {
				      $("#" + bc3_html_id).fadeIn("fast");
				      $("#" + bc3_html_id).removeClass("working");
				  } else {
				      consoleLog("SHOWING ", bc3_html_id);
				      $("#" + bc3_html_id).fadeIn("slow");
				      $("#" + bc3_html_id).addClass("working");
				  }
			      }
			  }
		      }
		      if (data.msgs.length > 0) {
			  msg_type = data.msgs[0][1];
			  msg_buf = data.msgs[0][2];
			  timestamp = data.msgs[0][0];
			  for (var i = 1; i < data.msgs.length; i++) {
			      if ((data.msgs[i][1] == msg_type)
				  && (msg_type != EVENT_NODES)) {
				  // merge messages if they have the same type
				  msg_buf += data.msgs[i][2];
			      } else {
				  //consoleLog('--->', msg_type, ': ', msg_buf);
				  consoleAddMessage("#console1", msg_type,
						    msg_buf, timestamp * 1000);
				  msg_type = data.msgs[i][1];
				  msg_buf = data.msgs[i][2];
				  timestamp = data.msgs[i][0];
			      }
			  }
			  //consoleLog('***>', msg_type, ': ', msg_buf);
			  consoleAddMessage("#console1", msg_type, msg_buf,
					    timestamp * 1000);
			  consoleScroll("#console1");
		      }
		      if (server_mode) {
			  scheduleUpdates(1000);
		      } else {
			  scheduleUpdates(10000);
		      }
		  }
	      })
	.error(
	       function() {
		   consoleAddMessage("#console1", CONSOLE_ERROR,
				     "Cannot communicate with server!\n");
	       });
    //consoleLog('JSON done');
}

function executeCommand(cmd, params) {
    var url_params = '';
    if (params) {
	for (var key in params) {
	    url_params += ('&' + encodeURIComponent(key)
			   + '=' + encodeURIComponent(params[key]));
	}
    }
    $.getJSON('exec?cmd=' + cmd + '&id=' + last_server_id + url_params,
	      function(data) {
		  if (data == null) {
		      consoleAddMessage("#console1", CONSOLE_ERROR,
					"Cannot communicate with server!\n");
		      consoleLog('ERROR NULL');
		  } else {
		      consoleLog(data);
		      if (data.id != last_server_id) {
			  consoleAddMessage("#console1", CONSOLE_ERROR,
					    "Server restarted.\n");
			  consoleScroll("#console1");
			  last_server_id = data.id;
			  scheduleUpdates(1000);
			  return;
		      }
		      if (data.error) {
			  consoleAddMessage("#console1", CONSOLE_ERROR,
					    "Server error: " + data.error
					    + ".\n");
		      }
		      if (data.msg) {
			  consoleAddMessage("#console1", CONSOLE_INFO,
					    "Server response: " + data.msg + ".\n");
		      }
		      consoleScroll("#console1");
		      scheduleUpdates(1000);
		  }
	      })
	.error(
	       function() {
		   consoleAddMessage("#console1", CONSOLE_ERROR,
				     "Cannot communicate with server!\n");
	       });
    //consoleLog('JSON done');
}

// ----------------------------------------------------------------------------
function vIMSDeploy(vimsdata) {
    consoleLog('VIMS:', vimsdata);
    executeCommand('deploy', vimsdata);
}


function vIMSDeployDialog(oper_idx) {
    consoleLog("*** VIMS ***");
    var html = '<table>';
    html += '<tr><td colspan="2">Router\'s OAM IP Configuration:</td></tr>';
    html += '<tr><td>&nbsp;- IP Address (x.x.x.x):</td><td><input type="text" name="oamaddr" id="oamaddr" value="10.87.69.2"></td></tr>';
    html += '<tr><td>&nbsp;- IP Network mask (x.x.x.x):</td><td><input type="text" name="oammask" id="oammask" value="255.255.255.192"></td></tr>';
    html += '<tr><td>&nbsp;- IP Default Gateway (x.x.x.x):</td><td><input type="text" name="oamgw" id="oamgw" value="10.87.69.1"></td></tr>';
    html += '<tr><td>Router\'s external interface:</td><td><input type="text" name="routernic" id="routernic" value="vmnic1"></td></tr>';
    html += '<tr><td colspan="2">Router Traffic Link IP Configuration:</td></tr>';
    html += '<tr><td>&nbsp;- IP Address (x.x.x.x):</td><td><input type="text" name="traddr" id="traddr" value="10.87.69.66"></td></tr>';
    html += '<tr><td>&nbsp;- IP Network mask (x.x.x.x):</td><td><input type="text" name="trmask" id="trmask" value="255.255.255.192"></td></tr>';
    html += '<tr><td>&nbsp;- IP Default Gateway (x.x.x.x):</td><td><input type="text" name="trgw" id="trgw" value="10.87.69.65"></td></tr>';
    html += '<tr><td colspan="2">&nbsp;</td></tr>';
    html += '<tr><td>TSP\'s OAM VIP IP Address (x.x.x.x):</td><td><input type="text" name="tspoamaddr" id="tspoamaddr" value="10.87.69.200"></td></tr>';
    html += '<tr><td>TSP\'s TR VIP IP Address (x.x.x.x):</td><td><input type="text" name="tsptraddr" id="tsptraddr" value="10.87.69.194"></td></tr>';
    html += '<tr><td>Denied Traffic Network Area (x.x.x.x/x):</td><td><input type="text" name="deniednet" id="deniednet" value="10.87.69.200/29"></td></tr>';
    html += '</table>';

    $("#dialog").html(html).attr("title", "Deploy new vIMS instance for " + db[oper_idx].name);
    $("#dialog").dialog({
        width: 500,
        autoOpen: true,
        modal: true,
        buttons : {
            "Deploy" : function() {
                $(this).dialog("close");
                $(this).dialog("destroy");
		var vimsdata = {
		    'name': db[oper_idx].name,
		    //'name': 'vIMS',
		    'oamaddr': $("#oamaddr").val(),
		    'oammask' : $("#oammask").val(),
		    'oamgw' : $("#oamgw").val(),
		    'routernic' : $("#routernic").val(),
		    'traddr' : $("#traddr").val(),
		    'trmask' : $("#trmask").val(),
		    'trgw' : $("#trgw").val(),
		    'tspoamaddr' : $("#tspoamaddr").val(),
		    'tsptraddr' : $("#tsptraddr").val(),
		    'deniednet' : $("#deniednet").val(),
		};
                vIMSDeploy(vimsdata);
            },
            "Cancel" : function() {
                $(this).dialog("close");
                $(this).dialog("destroy");
            }
        }
    });
}


function appStart(applicationIdx) {
    consoleLog("*** START ***");
    consoleAddMessage("#console1", CONSOLE_INFO,
		      'Starting new blade in app' + applicationIdx + '\n');
    executeCommand('start', null);
}

function appStop(applicationIdx) {
    consoleLog("*** STOP ***");
    consoleAddMessage("#console1", CONSOLE_INFO,
		      'Stopping blade in app' + applicationIdx + '\n');
    executeCommand('stop', null);
}

function appCheck(applicationIdx) {
    consoleLog("*** CHECK ***");
    consoleAddMessage("#console1", CONSOLE_INFO,
		      'Checking status of app' + applicationIdx + '\n');
    executeCommand('check', null);
}

function appAdd(operIdx) {
    consoleLog("*** ADD ***");
    consoleAddMessage("#console1", CONSOLE_INFO,
		      'Deploying new node for op' + operIdx + '\n');
    executeCommand('deploy', null);
}

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
    if (! obj._expanded) {
	$("#" + obj._html_id + " div.expcontent").hide();
    }
    $("#" + obj._html_id).toggle(function(_obj) {
	    return function() {
		$(this).find("div.expcontent").show("fast");
		_obj._expanded = true;
	    };
	}(obj), function(_obj) {
	    return function () {
		$(this).find("div.expcontent").hide("fast");
		_obj._expanded = false;
	    };
	}(obj));
}


function displayVMs(selector, vms) {
    for (var v = 0; v < vms.length; v++) {
	var vm = vms[v];
	if (! vm._html_id) {
	    vm._html_id = "vm" + newUniqueId();
	}
	if (! vm._expanded) {
	    vm._expanded = true;
	}
	if (! vm.status) {
	    vm.status = 'running';
	}
	if (vm.name == "vmsc02-bc03") {
	    // HACK
	    vm.status = bc3_status;
	    bc3_html_id = vm._html_id;
	    appendExpandableItem(selector, vm, '',
				 '<span class="ui-icon ui-icon-gear" style="float: left; margin-right: 5px;"></span>' + vm.name,
				 '<span class="vminfo">Status: <span id="bc3status">' + vm.status + '</span></span>');
	    if (bc3_status == "stopped") {
		$("#" + bc3_html_id).hide("fast");
	    }
	} else {
	    appendExpandableItem(selector, vm, '',
				 '<span class="ui-icon ui-icon-gear" style="float: left; margin-right: 5px;"></span>' + vm.name,
				 '<span class="vminfo">Status: ' + vm.status + '</span>');
	}
    }
}

function displayApps(selector, apps) {
    consoleLog(apps);
    for (var a = 0; a < apps.length; a++) {
	var app = apps[a];
	if (! app._html_id) {
	    app._html_id = "app" + newUniqueId();
	}
	if (! app._expanded) {
	    app._expanded = false;
	}
	var extra = '';
/*
	if (app.name.match(/-BC/)) {
	    extra = ' &nbsp; &nbsp; &nbsp; &nbsp; <span class="appgrow">Add blade</span><span class="appshrink">Remove blade</span><span class="appcheck">Quorum status</span>';
	}
*/
	appendExpandableItem(selector, app, '',
			     '<span class="ui-icon ui-icon-circle-triangle-e" style="float: left; margin-right: 5px;"></span>' + '<p>' + app.name + extra + '</p>',
			     '<ul class="vms"></ul>\n');

	$('#' + app._html_id + ' .appgrow').click(function(applicationIdx) {
		return function(event) {
		    event.stopImmediatePropagation();
		    appStart(applicationIdx);
		    return false;
		}
	    }(a));
	$('#' + app._html_id + ' .appgrow').button({icons: {primary: 'ui-icon-plusthick'}});
	$('#' + app._html_id + ' .appshrink').click(function(applicationIdx) {
		return function(event) {
		    event.stopImmediatePropagation();
		    appStop(applicationIdx);
		    return false;
		}
	    }(a));
	$('#' + app._html_id + ' .appshrink').button({icons: {primary: 'ui-icon-minusthick'}});
	$('#' + app._html_id + ' .appcheck').click(function(applicationIdx) {
		return function(event) {
		    event.stopImmediatePropagation();
		    appCheck(applicationIdx);
		    return false;
		}
	    }(a));
	$('#' + app._html_id + ' .appcheck').button({icons: {primary: 'ui-icon-search'}});
	displayVMs('#' + app._html_id + ' .vms', app.vms);
    }
}

function displayAll(selector) {
    var filter_op = getUrlParams()["op"];
    var filter_c = getUrlParams()["c"];
    for (var op = 0; op < db.length; op++) {
	var oper_data = db[op];
	if (filter_op && oper_data.name.indexOf(filter_op) < 0) {
	    continue;
	}
	if (filter_c && oper_data.name.indexOf(filter_c) < 0) {
	    continue;
	}
	if (! oper_data._html_id) {
	    oper_data._html_id = "oper" + newUniqueId();
	}
	$(selector).empty();
	$(selector).append('<h1>' + oper_data.name + '</h1>');
	$(selector).append('<ul class="apps" id="' + oper_data._html_id
			   + '"></ul>');
	displayApps('#' + oper_data._html_id, oper_data.apps);
	var extra = '';
/*
	if (oper_data.name.match(/\.nl/)) {
	    $('#' + oper_data._html_id).append('<li><span class="addapp">Add network element</span></li>');
	    $('#' + oper_data._html_id + ' .addapp').click(function(operIdx) {
		    return function(event) {
			event.stopImmediatePropagation();
			vIMSDeployDialog(operIdx);
			return false;
		    }
		}(op));
	    $('#' + oper_data._html_id + ' .addapp').button({icons: {primary: 'ui-icon-plusthick'}});
	}
*/
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

var previousPoint = null;

function drawLoadGraph() {
    var t1 = new Date().getTime(); // now
    var t0 = t1 - loadGraphPeriod * 60 * 1000;  // default: -20 minutes
    // setup plot
    var max_blades = 4.999;
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
		   max: max_blades,
		   position: "right",
		   color: "#b1b3b4" } ],
	legend: { position: 'nw',
		  sorted: true },
	colors: colors
    };
    var lowLine = [[t0, lowLoad], [t1, lowLoad]];
    var highLine = [[t0, highLoad], [t1, highLoad]];

    // FIXME: test
    var bladeEvents = [[t0 * 2/3 + t1 * 1/3, 1],
		       [t0 * 1/2 + t1 * 1/2, 2],
		       [t0 * 1/3 + t1 * 2/3, 1]];

    if (bladeData.length > 0) {
	bladeData.push( [ t1,
			  bladeData[bladeData.length - 1][1] ] );
    }
    plot = $.plot($("#loadgraph"), [ { data: bladeData,
				       lines: { fill: true },
				       label: "Number of virtual processors",
				       yaxis: 2 },
				     lowLine,
				     highLine,
				     { data: loadData,
				       label: "MSC-S BC load" },
/*
				     { data: bladeEvents,
				       lines: { show: false },
				       points: { show: true },
				       yaxis: 2 },
*/
				   ], options);
    if (bladeData.length > 1) {
	bladeData.pop();
    }
    /*
    var tx = (t0 + t1) / 2;
    var o = plot.pointOffset( { x: tx, y: 1, yaxis: 2 } );
    var ctx = plot.getCanvas().getContext("2d");
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
		var msg = "Time: " + h + ":" + m + ":" + s + "<br>";
		if (item.seriesIndex == 0) {
		    msg += "Number of virtual processors: <b>" + item.datapoint[1] + "</b>";
		} else if (item.seriesIndex == 1) {
		    msg = "Low threshold: <b>" + item.datapoint[1] + "%</b>";
		} else if (item.seriesIndex == 2) {
		    msg = "High threshold: <b>" + item.datapoint[1] + "%</b>";
		} else if (item.seriesIndex == 3) {
		    msg += "MSC load: <b>" + item.datapoint[1].toFixed(2) + "%</b>";
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
}

var updateGraphErrors = 0;

function updateGraph() {
//    consoleLog("Requesting load, start = " + loadDataStart);
    $.getJSON('load?start=' + loadDataStart + '&max=' + maxPoints
	      + '&lt=' + lowLoad + '&ht=' + highLoad,
	      function(data) {
		  if (data == null) {
		      consoleAddMessage("#console1", CONSOLE_ERROR,
					"Cannot communicate correctly with load server!\n");
//		  } else {
//		      consoleLog(data);
		  }
		  loadDataStart = data.last;
		  if (data.load.length > 0) {
		      //loadData.push.apply(loadData, data.load);
		      for (var i = 0; i < data.load.length; i++) {
			  loadData.push( [ data.load[i][0] * 1000,
					   data.load[i][1] ] );
		      }
		      if (loadData.length > maxPoints) {
			  loadData = loadData.slice(loadData.length - maxPoints);
		      }
		      drawLoadGraph();
/*
		      if (loadData.length > 1) {
//			  consoleLog("Drawing " + loadData.length + " values");
			  var t0 = loadData[0][0];
			  var t1 = loadData[loadData.length - 1][0];
			  var lowLine = [[t0, lowLoad], [t1, lowLoad]];
			  var highLine = [[t0, highLoad], [t1, highLoad]];
			  // ensure that the numBlades graph starts and stops
			  // near t0 and t1
			  var b = 0;
			  while (b < bladeData.length - 1) {
			      if (bladeData[b][0] > t0)
				  break;
			      b++;
			  }
			  if (b > 0)
			      b--;
			  if (b - bladeData.length > 1) {
			      consoleLog("XXXXXXXXXX removing ", b, " bladeData");
			      bladeData = bladeData.splice(b);
			      consoleLog("XXXXXXXXXX bladeData = ", bladeData);
			  }
			  var saved_t;
			  if (bladeData.length > 0) {
			      saved_t = bladeData[bladeData.length - 1][0];
			      bladeData[bladeData.length - 1][0] = t1;
			      bladeData[0][0] = t0;
			      consoleLog("XXXXXXXXX> bladeData = ", bladeData);
			  }
			  // draw the data
			  plot.setData([ { data: bladeData,
					   lines: { fill: true },
					   label: "Number of blades",
					   yaxis: 2 },
					 lowLine,
					 highLine,
					 { data: loadData,
					   label: "MSC load"
					 },
				       ]);
			  plot.setupGrid();
			  plot.draw();
			  if (bladeData.length > 0) {
			      bladeData[bladeData.length - 1][0] = saved_t;
			      consoleLog("XXXXXXXXX< bladeData = ", bladeData);
			  }
		      }
*/
//		  } else {
//		      consoleLog("Received empty load info");
		  }
		  updateGraphErrors = 0;
		  setTimeout(updateGraph, loadUpdateInterval);
	      }).error(
		  function() {
		      if (updateGraphErrors == 0) {
			  consoleAddMessage("#console1", CONSOLE_ERROR,
					    "Cannot communicate with load server!\n");
		      }
		      updateGraphErrors++;
		      setTimeout(updateGraph, loadUpdateInterval + 1000 * updateGraphErrors);
		  });
}	  

function doUpdates() {
    fetchLog();
}

// init
$(function() {
    // FIXME: make sure that the tabs occupy the whole center pane
    $("#tabs").tabs({ active: 1 });
    $("#tabs").css({ 'padding': '0px',
		     'margin': '0px',
		     'background': 'none', 
		     'border-width': '0px',
		   });

    var layout = $('body').layout({ applyDefaultStyles: true });
    $(".ui-layout-center").css('padding', '0px');
    layout.sizePane("south", 180);
    layout.sizePane("west", 200);
    layout.hide("west");
    // layout.sizePane("east", 350);
    consoleLog("initializing portal");
    displayAll('#vmlist');
    $("#cmdpause1").button({icons: {primary: 'ui-icon-shuffle'},
		            label: "Pause 3 min"})
	.click(function() {
	    executeCommand("loadctrl", { n: 1, t: 150 });
	});
    $("#cmdpause2").button({icons: {primary: 'ui-icon-shuffle'},
		            label: "Pause 4 min"})
	.click(function() {
	    executeCommand("loadctrl", { n: 2, t: 210 });
	});
    $("#cmdrestart1").button({icons: {primary: 'ui-icon-refresh'},
		              label: "Restart"})
	.click(function() {
	    executeCommand("loadctrl", { n: 1, t: 0 });
	});
    $("#cmdrestart2").button({icons: {primary: 'ui-icon-refresh'},
		              label: "Restart"})
	.click(function() {
	    executeCommand("loadctrl", { n: 2, t: 0 });
	});
    $("#clearcons").button({icons: {primary: 'ui-icon-trash'},
		            label: "Clear"})
	.click(function() {
	    consoleClear("#console1");
	});
    $("#cmdping").button({icons: {primary: 'ui-icon-transferthick-e-w'},
		          label: "Ping"})
	.click(function() {
	    executeCommand("ping", null);
	});
    $("#cmdstatus").button({icons: {primary: 'ui-icon-search'},
		            label: "Status?"})
	.click(function() {
	    executeCommand("status", null);
	});
    // add a refresh button
    /*
    $("#refresh").button({icons: {primary: 'ui-icon-refresh'}, label: "Refresh"})
      .click(function() {
        doUpdates();
        });
    */

    // create the layout
    /*
    $('body').layout({ applyDefaultStyles: true });
    */
    /*
    $("body").layout( {
      closable:  true,
      resizable: true,
      slidable:  true,
      north__slidable: false,
      north__resizable: false,
      south__slidable: true,
      south__resizable: true,
      south__size: 200,
    });
    */

    // setup load graph control widgets
    $("#lowload").val(lowLoad).change(function () {
        var v = $(this).val();
        if (!isNaN(+v)) {
            lowLoad = +v;
            if (lowLoad > highLoad - 10)
                lowLoad = highLoad - 10;
            if (lowLoad < 0)
                lowLoad = 0;
            $(this).val("" + lowLoad);
        }
    });
    $("#highload").val(highLoad).change(function () {
        var v = $(this).val();
        if (v && !isNaN(+v)) {
            highLoad = +v;
            if (highLoad < lowLoad + 10)
                highLoad = lowLoad + 10;
            if (highLoad > 100)
                highLoad = 100;
            $(this).val("" + highLoad);
        }
    });
    $("#updateInterval").val(loadUpdateInterval).change(function () {
        var v = $(this).val();
        if (v && !isNaN(+v)) {
            loadUpdateInterval = +v;
            if (loadUpdateInterval < 500)
                loadUpdateInterval = 500;
            if (loadUpdateInterval > 60000)
                loadUpdateInterval = 60000;
            $(this).val("" + loadUpdateInterval);
        }
    });
    $("#graphPeriod").val(loadGraphPeriod).change(function () {
        var v = $(this).val();
        if (v && !isNaN(+v)) {
            loadGraphPeriod = +v;
            if (loadGraphPeriod < 1)
                loadGraphPeriod = 1;
            if (loadGraphPeriod > 60)
                loadGraphPeriod = 60;
            $(this).val("" + loadGraphPeriod);
        }
    });

    // setup plot
    var max_blades = 4.999;
    var options = {
        series: { shadowSize: 0 }, // drawing is faster without shadows
        xaxis: { mode: "time", timezone: "browser" },
	yaxes: [ { min: 0, max: 100,
		   color: "#00a9d4",
		   tickFormatter: function(v, axis) { return v + "% "; } },
		 { min: 0, max: max_blades,
		   position: "right", color: "#b1b3b4" } ],
	legend: { position: 'nw' },
	colors: [ "#d1d2d4", "#89ba17", "#e32119", "#00a9d4" ]
    };
    var lowLine = [[0, lowLoad], [maxPoints, lowLoad]];
    var highLine = [[0, highLoad], [maxPoints, highLoad]];

    plot = $.plot($("#loadgraph"), [ { data: [], label: "Number of virtual processors" },
				     lowLine,
				     highLine,
				     { data: [], label: "MSC load" },
				   ], options);
    $("#loadgraph").resize(function () {
    });

    consoleLog("fetching console log...");
    scheduleUpdates(500);
    updateGraph();
});
