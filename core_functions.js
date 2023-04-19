var fs = require("fs");

var fileFunctions  = require('./file');
var queryFunctions = require('./query');
var table = require('./config')['table'];

function add_migration(argv, path, cb) {
  fileFunctions.validate_file_name(argv[4]);
  fileFunctions.readFolder(path, function (files) {
    var file_name = Date.now() + "_" + argv[4];
    var file_path = path + '/' + file_name + '.js';

    var sql_json = {
      up   : '',
      down : ''
    };

    if (argv.length > 5) {
      sql_json['up'] = argv[5];
    }

    var content = 'module.exports = ' + JSON.stringify(sql_json, null, 4);
    fs.writeFile(file_path, content, 'utf-8', function (err) {
      if (err) {
        throw err;
      }

      console.log("Added file " + file_name);
      cb();
    });
  });
}

function up_migrations(container, max_count, path, cb) {
  queryFunctions.run_query(container, "SELECT timestamp FROM " + table + " ORDER BY timestamp ASC", function (results) {
    var file_paths = [];
    fileFunctions.readFolder(path, (files) => {
      for (file of files) {
        if (String(file).startsWith('.')) {
          // . で始まるものは飛ばす
          continue;
        }
        var timestamp_split = file.split('_', 1);
        if (timestamp_split.length > 0) {
          var timestamp = Number(timestamp_split[0]);
          if (!timestamp) {
            // 数字以外のものは飛ばす
            continue;
          }
          if (timestamp.toString().length !== 13 && timestamp.toString().length !== 14) {
            throw new Error('Invalid file ' + file);
          }
          const ret = results.find(obj => Number(obj.timestamp) === timestamp);
          if (!ret) {
            file_paths.push({ timestamp : timestamp, file_path : file});
          }
        } else {
          throw new Error('Invalid file ' + file);
        }
      }

      var final_file_paths = file_paths.sort(function(a, b) { return (a.timestamp - b.timestamp)}).slice(0, max_count);

      queryFunctions.execute_query(container, path, final_file_paths, 'up', cb);
    });
  });
}

function down_migrations(container, max_count, path, cb) {
  queryFunctions.run_query(container, "SELECT timestamp FROM " + table + " ORDER BY timestamp DESC LIMIT " + max_count, function (results) {
    var file_paths = [];
    var max_timestamp = 0;
    if (results.length) {
      var temp_timestamps = results.map(function(ele) {
        return ele.timestamp;
      });

      fileFunctions.readFolder(path, function (files) {
        files.forEach(function (file) {
          var timestamp = file.split("_", 1)[0];
          if (temp_timestamps.indexOf(timestamp) > -1) {
            file_paths.push({ timestamp : timestamp, file_path : file});
          }
        });

        var final_file_paths = file_paths.sort(function(a, b) { return (b.timestamp - a.timestamp)}).slice(0, max_count);
        queryFunctions.execute_query(container, path, final_file_paths, 'down', cb);
      });
    }
  });
}

function down_skip_migrations(container, max_count, path, cb) {
  queryFunctions.run_query(container, "SELECT timestamp FROM " + table + " ORDER BY timestamp DESC LIMIT " + max_count, function (results) {
    var max_timestamp = 0;
    if (results.length) {
      var temp_timestamps = results.map(function(ele) {
        return ele.timestamp;
      });
      queryFunctions.updateRecords(container, "down", table, temp_timestamps, cb);
    } else {
      cb();
    }
  });
}

function set_migrations(container, timestamp_val, path, cb) {

  var timestamps = [];
  fileFunctions.readFolder(path, function (files) {
    files.forEach(function (file) {
      var timestamp = file.split("_", 1)[0];
      timestamps.push(timestamp);
    });
    queryFunctions.updateRecords(container, 'set', table, timestamps, cb);
  });
}


function run_migration_directly(file, type, container, path, cb) {
  var current_file_path = path + "/" + file;
  var timestamp_split = file.split("_", 1);
  if (0 === timestamp_split.length) {
    throw new Error('Invalid file ' + file);
  }
  var file_paths = [];
  var timestamp = parseInt(timestamp_split[0]);
  if (!Number.isInteger(timestamp)) {
    return;
  }
  if (timestamp.toString().length !== 13 && timestamp.toString().length !== 14) {
    return;
  }
  if (['up_force', 'down_force'].includes(type)) {
    file_paths.push({ timestamp : timestamp, file_path : file});
    queryFunctions.execute_query(container, path, file_paths, type, cb);
    return;
  }
  queryFunctions.run_query(container, "SELECT timestamp FROM " + table + " WHERE timestamp = " + timestamp + " ORDER BY timestamp ASC", function (results) {
    if ( (type === 'up' && !results.length) || (type === 'down' && results.length) ) {
      file_paths.push({ timestamp : timestamp, file_path : file});
      queryFunctions.execute_query(container, path, file_paths, type, cb);
    } else {
      cb();
    }
  });
}

module.exports = {
  add_migration: add_migration,
  up_migrations: up_migrations,
  down_migrations: down_migrations,
  down_skip_migrations: down_skip_migrations,
  set_migrations: set_migrations,
  run_migration_directly: run_migration_directly
};
