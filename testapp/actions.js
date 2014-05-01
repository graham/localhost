var last_event = [];
var data = [];
var focus_index = 0;
var env = new genie.Environment();
var storage = new storage_engine.StorageEngine();
var client = null;
var datastore = null;
var unique_id = "" + new Date().getTime();
var filters = [];
var kap = null;
var get_data = null
var taskTable = null;
var metaTable = null;
var deletedTasks = null;
var refresh = null;

var str_trim = function(s) { return s.replace(/^\s+|\s+$/g, "").replace(/^[\n|\r]+|[\n|\r]+$/g, ""); };

var x_in_list = function(x, the_list) {
    var l = the_list.length;
    for(var i = 0; i < l; i += 1) {
        if (x == the_list[i]) {
            return true;
                }
    }
    return false;
};

function logit(message) {
    $('#log').prepend("<div>" + message + "</div>");
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}
                  
$(document).ready(function() {
    if (window.location.href.slice(0, 5) == "http:" &&
        window.location.href.search("http://localhost") == -1) { 
        window.location.href = "https:" + window.location.href.slice(5);
    } else {
        client = new Dropbox.Client({key: "qc2kmbfgwmmocaq"});
        // Try to finish OAuth authorization.
        client.authenticate({interactive: false}, function (error) {
            if (error) {
                alert('Authentication error: ' + error);
            }
        });
        
        if (client.isAuthenticated()) {
            setup_all();
        } else {
            client.authenticate();
        }
    }
});

function setup_all() {
    var datastoreManager = client.getDatastoreManager();
    datastoreManager.openDefaultDatastore(function (error, datastore) {
        if (error) {
            alert('Error opening default datastore: ' + error);
        }
        
        // Now you have a datastore. The next few examples can be included here.
        dataStoreReady(datastore);
    });
}

function dataStoreReady(dsm) {
    datastore = dsm;
    taskTable = dsm.getTable('tasks');
    metaTable = dsm.getTable('meta');
    deletedTasks = dsm.getTable('deleted');

    var g = env.load_templates(
            ["encase.genie", "lineitem.genie"], 
            function() {
                refresh();
            });

    // ensure data is in good shape.
    var data = taskTable.query();
    for (var i=0; i < data.length; i++) {
        var row = data[i];
        if (row.get('deferred') == null) {
            row.set('deferred', false);
        }
    }
    // yup, we are good.

    var color_for_word = function(word) {
        var index = 0;
        var colors = [0, 0, 0];
        for(var i=0; i < word.length; i++) {
            var ch = word.charCodeAt(i);
            colors[index] += ch * ch * ch;
            index += 1;
            index %= 3;
        }
        return "rgba(" + 
            (64 + (colors[0] % 224)) + ", " + 
            (64 + (colors[1] % 224)) + ", " + 
            (64 + (colors[2] % 224)) + ", 0.85)";
    };

    var pull_tags = function(input) {
        if (input[0] == '^') {
            var init_tokens = input.split(' ');
            var cl_tokens = input.slice(init_tokens[0].length).split(';');
            var index = parseInt(init_tokens[0].slice(1));
            var tags = [];
            if (isNaN(index)) { index = 0; }

            var tokens = cl_tokens[index].split(' ')
            for(var j=0; j < tokens.length; j++) {
                var token = tokens[j].toLowerCase();
                if (token[0] == '#' && !x_in_list(token, tags)) {
                    tags.push(token);
                }
            }
            tags.sort();
            return tags;
        } else {
            var tags = [];
            var tokens = input.split(' ');
            for(var j=0; j < tokens.length; j++) {
                var token = tokens[j].toLowerCase();
                if (token[0] == '#' && !x_in_list(token, tags)) {
                    tags.push(token);
                }
            }
            tags.sort();
            return tags;
        }
    };

    env.set_obj('render_tags', function(input) {
        var tags = pull_tags(input);
        var result = [];
        for(var i = 0; i < tags.length; i++) {
            (function(token) {
                result.push("<div class='li_project' style='background-color: " +
                            color_for_word(token) + ";'>" + token + "</div>");
                })(tags[i]);
        }
        return result.join('');
    });

    env.set_obj('render_checklist', function(input) {
        var tokens = input.split(' ');
        var cl_tokens = input.slice(tokens[0].length).split(';');
        var index = parseInt(tokens[0].slice(1));
        if (isNaN(index)) { index = 0; }
        var result = [];

        result.push( " " + (index+1) + " / " + cl_tokens.length + " " );

        if (index > 0) {
            result.push(' ... ');
        }
        result.push(  "<span style='text-decoration:underline; text-decoration-color: rgba(128, 128, 128, 0.5);'>" + str_trim(cl_tokens[index]) + "</span>" );
        if (index < (cl_tokens.length - 1)) {
            result.push(' ... ');
        }

        return result.join(' ');
    });

    env.set_obj('x_in_list', x_in_list);
    env.set_obj('pull_tags', pull_tags);

    var all_negative_filters = function(filters) {
        var normal_hit = false;
        $(filters).each( function(index, item) {
            if (item.slice(0, 2) != '#/') {
                normal_hit = true;
            }
        });
        return !normal_hit;
    };

    get_data = function() {
        var data = taskTable.query({'deferred':false});
        data.sort(function(a,b){ 
            /*if (x_in_list('#done', pull_tags(a.get('slug'))) && !x_in_list('#done', pull_tags(b.get('slug')))) {
                return 1;
            } else if (!x_in_list('#done', pull_tags(a.get('slug'))) && x_in_list('#done', pull_tags(b.get('slug')))) {
                return -1;
            } else {*/
                return (b.get('created', 0) - a.get('created', 0));
//            }
        });

        var filtered = [];
        var searcher = $("#search");
        if (searcher.val().length && searcher.val()[0] == ':') {
            for(var i = 0; i < data.length; i++) {
                var item = data[i];
                var item_hit = true;

                $(searcher.val().slice(1).split(' ')).each( function(index, searchterm) {
                    if (item.get('slug').toLowerCase().search(searchterm.toLowerCase()) == -1) {
                        item_hit = false;
                    }
                });

                if (item_hit == true) {
                    filtered.push(item);
                }
            }
            return filtered;
        } else if (filters.length > 0 && !all_negative_filters(filters)) {
            for(var i = 0; i < data.length; i++) {
                var item = data[i];
                var item_tags = pull_tags(item.get('slug'));
                var item_hit = false;
                
                for(var j = 0; j < item_tags.length; j++) {
                    var tag = item_tags[j];
                    if (x_in_list(tag, filters)) {
                        item_hit = true;
                    }
                }

                $(filters).each( function(index, item) {
                    var extag = '#' + item.slice(2);
                    if (item.slice(0, 2) == '#/' && x_in_list(extag, item_tags) ) {
                        item_hit = false;
                    }
                });
                
                if (item_hit) {
                    filtered.push(item);
                }
            }
            return filtered;
        } else if (filters.length > 0 && all_negative_filters(filters)) {
            for(var i = 0; i < data.length; i++) {
                var item = data[i];
                var item_tags = pull_tags(item.get('slug'));
                var item_hit = true;

                $(filters).each( function(index, item) {
                    var extag = '#' + item.slice(2);
                    if (item.slice(0, 2) == '#/' && x_in_list(extag, item_tags) ) {
                        item_hit = false;
                    }
                });
                
                if (item_hit) {
                    filtered.push(item);
                }
            }
            return filtered;
        } else {
            return data;
        }
    };
    
    var deselect_all = function() {
        var data = get_data();
        for(var i = 0; i < data.length; i++) {
            var row = data[i];
            if (row.get('selected') == true) {
                row.set('selected', false);
            }
        }
    };

    var updateStatus = function() {
        setTimeout(function() {
            if (dsm.getSyncStatus()['uploading'] == true) {
                $("#status").html("Syncing...");
                updateStatus();
            } else {
                $("#status").html("Sync Complete");
            }
        }, 1000);
    };

    refresh = function() {
        updateStatus();

        $('#deferred_info').html("" + taskTable.query({'deferred':true}).length);
        $('#total_info').html("" + taskTable.query().length);

        var data = get_data();
        var result = env.render("encase.genie", {'lines':data});
        if (filters.length) {
            $('#filter-list').html('Filters: ' + env.get_obj('render_tags')(filters.join(' ')));
        } else {
            $('#filter-list').html('');
        }
        $('#the-list').html(result);
        $('#filtered_info').html("" + taskTable.query({'deferred':false}).length - data.length);

        $('.li_checkbox > input').change( function(event) {
            var input = event.target;
            var row = $(input).parent().parent();
            var dbrow = taskTable.query({'uid':row.attr('id')})[0];

            if (input.checked == true) {
                dbrow.set('selected', true);
                row.addClass('li_row_selected');
            } else {
                dbrow.set('selected', false);
                row.removeClass('li_row_selected');
            }
        });

        $('.li_project').click( function(event) {
            console.log(event);
            var tag = event.target.innerText;
            var antitag = "#/" + tag.slice(1);
            if (event.altKey == true) {
                if (!x_in_list(antitag, filters)) {
                    filters.push(antitag);
                }
            } else {
                if (!x_in_list(tag, filters)) {
                    filters.push(tag);
                }
            }
            refresh();
        });

        select_index(focus_index);
    };

    dsm.recordsChanged.addListener(function (event) {
        console.log('records changed:', event.affectedRecordsForTable('tasks'));
        refresh();
    });                                                                    

    function select_index(index) {
        var data = get_data();
        var id = data[focus_index];

        if (id) {
            $('#' + id.get('uid')).removeClass('active_li');
        }

        focus_index = index;
        if (focus_index < 0) { focus_index = 0; }
        if (focus_index > (data.length-1)) { focus_index = data.length-1; }

        id = data[focus_index];
        if (id) {
            $('#' + id.get('uid')).addClass('active_li');
        }
    }

    kap = new Kapture();
    kap.safe_input = true;

    kap.anyevent_command(function(term) {
        if (document.activeElement == document.getElementById('search')) {
            var ele = $(document.activeElement);
            if (ele.val().length && ele.val()[0] == ':') {
                refresh();
            }
        }
    });
    
    kap.add_command('control-x control-f', function(term) {
        logit("load file.");
    });

    kap.add_command('control-x control-r', function(term) {
        refresh();
        logit("reloaded from data");
    });
    
    kap.add_passive_command('j', function(term) {
        select_index(focus_index+1);
    });
    
    kap.add_passive_command('shift-j', function(term) {
        focus_index = get_data().length;
        select_index(focus_index);
    });

    kap.add_passive_command('k', function(term) {
        select_index(focus_index-1);
    });

    kap.add_passive_command('shift-k', function(term) {
        select_index(0);
    });
    
    kap.add_passive_command('p', function(term) {
        var data = get_data();
        
        var dbrow = data[focus_index];
        var row = $('#' + data[focus_index].get('uid'));
        var input = $('#' + data[focus_index].get('uid')).find('input')[0];
        
        if (dbrow.get('slug')[0] == '^') {
            var input = dbrow.get('slug');
            var tokens = input.split(' ');
            var cl_tokens = input.slice(tokens[0].length).split(';');
            var index = parseInt(tokens[0].slice(1));
            if (index > 0) {
                index -= 1;
            }
            var new_tokens = [];
            $(cl_tokens).each(function(index, item) {
                new_tokens.push(str_trim(item));
            });
            dbrow.set('slug', '^'+index+' '+new_tokens.join(' ; '));
        }
        refresh();
    });

    kap.add_passive_command('n', function(term) {
        var data = get_data();

        var dbrow = data[focus_index];
        var row = $('#' + data[focus_index].get('uid'));
        var input = $('#' + data[focus_index].get('uid')).find('input')[0];

        if (dbrow.get('slug')[0] == '^') {
            var input = dbrow.get('slug');
            var tokens = input.split(' ');
            var cl_tokens = input.slice(tokens[0].length).split(';');
            var index = parseInt(tokens[0].slice(1));
            if (index < (cl_tokens.length - 1)) {
                index += 1;
            }
            var new_tokens = [];
            $(cl_tokens).each(function(index, item) {
                new_tokens.push(str_trim(item));
            });
            dbrow.set('slug', '^'+index+' '+new_tokens.join(' ; '));
        }
        refresh();
    });

    kap.add_passive_command('/', function(term) {
        $('#search').focus();
    });

    kap.add_passive_command('tab', function(term) {
        $('#search').val('');
        refresh()
        $('#search').focus();
    });

    kap.add_command('esc', function(term) {
            if (document.activeElement) {
                $(document.activeElement).blur();
            }
        });

    kap.add_passive_command('v', function(term) {
        var data = get_data();
        var dbrow = data[focus_index];
        
        $(dbrow.get('slug').split(' ')).each(function(index, item) {
            if (item.slice(0, 4) == 'http') {
                window.open(item);
            }
        });
        
        var row = $('#' + data[focus_index].get('uid'));
        var input = $('#' + data[focus_index].get('uid')).find('input')[0];
        
        if (!input.checked) {
            input.checked = true;
            dbrow.set('selected', true);
            row.addClass('li_row_selected');
        } else {
            input.checked = false;
            dbrow.set('selected', false);
            row.removeClass('li_row_selected');
        }
        
    });
    
    kap.add_passive_command('b', function(term) {
        var data = taskTable.query({'deferred':true});
        var filtered = [];

        for(var i = 0; i < data.length; i++) {
            var row = data[i];
            if (filters.length) {
                for(var i = 0; i < data.length; i++) {
                    var item = data[i];
                    var item_tags = pull_tags(item.get('slug'));
                    var item_hit = false;
                    
                    for(var j = 0; j < item_tags.length; j++) {
                    var tag = item_tags[j];
                        if (x_in_list(tag, filters)) {
                            item_hit = true;
                        }
                    }
                    
                    $(filters).each( function(index, item) {
                        var extag = '#' + item.slice(2);
                        if (item.slice(0, 2) == '#/' && x_in_list(extag, item_tags) ) {
                            item_hit = false;
                        }
                    });
                    
                    if (item_hit) {
                        filtered.push(item);
                    }
                }
                if (filtered.length) {
                    filtered[0].set('deferred', false);
                    refresh();
                    return;
                }
            } else {
                row.set('deferred', false);
                refresh();
                return;
            }
        }
    });

    kap.add_passive_command('shift-b', function(term) {
        var data = taskTable.query({'deferred':true});
        var filtered = [];

        for(var i = 0; i < data.length; i++) {
            var row = data[i];
            if (filters.length) {
                for(var i = 0; i < data.length; i++) {
                    var item = data[i];
                    var item_tags = pull_tags(item.get('slug'));
                    var item_hit = false;
                    
                    for(var j = 0; j < item_tags.length; j++) {
                    var tag = item_tags[j];
                        if (x_in_list(tag, filters)) {
                            item_hit = true;
                        }
                    }
                    
                    $(filters).each( function(index, item) {
                        var extag = '#' + item.slice(2);
                        if (item.slice(0, 2) == '#/' && x_in_list(extag, item_tags) ) {
                            item_hit = false;
                        }
                    });
                    
                    if (item_hit) {
                        item.set('deferred', false);
                    }
                }
            } else {
                row.set('deferred', false);
            }
        }
        refresh();
    });

    kap.add_passive_command('d', function(term) {
        var rows = $('.li_row_selected');
        for( var i = 0; i < rows.length; i++ ) {
            var obj = rows[i];
            var result = taskTable.query({'uid':obj.id});
            if (result.length) {
                result[0].set('deferred', true);
            }
        }
        refresh();
    });

    $('#thesearch').submit(function() {
        (function() {
            var title = $("#search").val();

            if (title.length == 0 || title[0] == ':') {
                $(document.activeElement).blur();
                return;
            }
            
            if (title[0] == '/') {
                $(title.split(' ')).each(function(index, item) {
                    if (item[0] == '/') {
                        add_filter(item);
                    }
                });
            } else {
                add_task(title);
            }
            try {
                refresh();
            } catch (e) {
                console.log(e);
            }

            $("#search").val('');
            $(document.activeElement).blur();
        })();
        return false;
    });

    var add_task = function(title, options) {
        title = str_trim(title);
        if (title.length == 0) {
            return;
        }

        if (options == undefined) {
            options = {};
        }

        if (filters.length) {
            var tokens = title.split(' ');
            $(filters).each(function(index, item) {
                if (!x_in_list(item, title.split(' ')) && item[1] != '/') {
                    title += ' ' + item;
                }
            });
        }

        taskTable.insert({
            "uid":guid(),
            "slug":title,
            "state":0,
            "created":new Date().getTime(),
            "origin":"none",
            "selected":options['is_selected'] || false,
            "deferred":false,
        });
    };

    var add_filter = function(title) {
        var text = title.slice(1);
        if (!x_in_list(text, filters)) {
            filters.push("#" + text);
        }
    };
    
    kap.add_passive_command('x', function(term) {
        var data = get_data();

        var dbrow = data[focus_index];
        var row = $('#' + data[focus_index].get('uid'));
        var input = $('#' + data[focus_index].get('uid')).find('input')[0];

        if (!input.checked) {
            input.checked = true;
            dbrow.set('selected', true);
            row.addClass('li_row_selected');
        } else {
            input.checked = false;
            dbrow.set('selected', false);
            row.removeClass('li_row_selected');
        }
    });

    kap.add_passive_command('y', function(term) {    
        var rows = $('.li_row_selected');
        for(var i = 0; i < rows.length; i++) {
            var obj = rows[i];
            var result = taskTable.query({'uid':obj.id});
            if (result.length) {
                deletedTasks.insert({'slug':result[0].get('slug'), 'uid':result[0].get('uid'), 'deleted':new Date().getTime()});
                result[0].deleteRecord();
            }
        }
        refresh();
    });

    kap.add_passive_command('e', function(term) {
        var data = get_data();

        var dbrow = data[focus_index];
        var row = $('#' + data[focus_index].get('uid'));
        var input = $('#' + data[focus_index].get('uid')).find('input')[0];

        $("#search").val( dbrow.get('slug') );
        dbrow.deleteRecord();
        refresh();
        $('#search').focus();
    });

    kap.add_passive_command('[', function(term) {
        $('#search').val('');
        filters = [];
        refresh();
    });

    kap.add_passive_command(']', function(term) {
        var data = get_data();

        var dbrow = data[focus_index];
        var row = $('#' + data[focus_index].get('uid'));
        var input = $('#' + data[focus_index].get('uid')).find('input')[0];

        filters = pull_tags(dbrow.get('slug'));
        focus_index = 0;
        refresh();
    });

    kap.add_passive_command('r', function(term) {
        window.open('/recovery.html');
    });

    kap.add_passive_command('f', function(term) {
        var data = get_data();
        var dbrow = data[focus_index];
        var tags = pull_tags(dbrow.get('slug'));

        if (dbrow.get('slug')[0] == '^') { return; }

        if (!x_in_list('#done', tags)) {
            dbrow.set('slug', dbrow.get('slug') + ' #done');
        } else {
            dbrow.set('slug', dbrow.get('slug').replace("#done", ''));
        }
        refresh();
    });

    var add_key_template = function(key, tag) {
        kap.add_passive_command(key, function(term) {
            filters = ['#' + tag];
            refresh();
        });

        kap.add_passive_command('control-shift-' + key, function(term) {
            var data = get_data();
            var dbrow = data[focus_index];
            var tags = pull_tags(dbrow.get('slug'));
            if (!x_in_list('#' + tag, tags)) {
                dbrow.set('slug', dbrow.get('slug') + ' #' + tag);
            } else {
                dbrow.set('slug', dbrow.get('slug').replace("#" + tag, ''));
            }
            refresh();
        });
        
        kap.add_passive_command('shift-' + key, function(term) {
            filters = ["#/" + tag];
            refresh();
        });
    };

    add_key_template('1', 'life');
    add_key_template('2', 'work');
    add_key_template('3', 'focus');
    add_key_template('8', 'localhost');
    add_key_template('9', 'pulled');
    add_key_template('0', 'done');

    kap.add_command('`', function(term) {
        $('#search').val('');
        filters = [];
        deselect_all();
        refresh();
    });

    kap.on_push = function(key) {
        console.log('PUSH:' + key);
    };
    
    kap.add_passive_command('shift-/', function(term) {
        alert('help');
    });

    var steal_keys = function(event) {
        last_event = event;
        kap.key_down(event);
    };
    
    var steal_focus = function() {
        $(window).keydown(steal_keys);
    };
    
    var return_focus = function() {
        $(window).removeEvent('keydown', steal_keys);
    };
    
    $(window).ready(function() {
        steal_focus();
    });
};

