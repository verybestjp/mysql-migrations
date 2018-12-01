var table = require('./config')['table'];
var fileFunctions  = require('./file');

function run_query(conn, query, cb) {
  conn.getConnection(function(err, connection) {
    if (err) {
      throw err;
    }
    if (!Array.isArray(query)) {
      query = [query];
    }
    if (0 === query.length || !query[0]) {
      connection.release();
      return cb();
    }
    var query_it = query.shift();
    if (process.env.VERBOSE) {
      console.log(query_it);
    }
    connection.query(query_it, function (error, results, fields) {
      if (error) {
        throw error;
      }
      if (query.length > 0) {
        run_query(conn, query, cb);
        return;
      }
      connection.release();
      cb(results);
    });
  });
}

function execute_query(conn, path, final_file_paths, type, cb) {
  if (final_file_paths.length) {
    var file_name = final_file_paths.shift()['file_path'];
    var current_file_path = path + "/" + file_name;

    var queries = require(current_file_path);
    var timestamp_val = file_name.split("_", 1)[0];
    if (Array.isArray(queries[type])) {
      run_query(conn, queries[type].slice(0), function (res) {
        updateRecords(conn, type, table, timestamp_val, function () {
          execute_query(conn, path, final_file_paths, type, cb);
        });
      });
    } else if (typeof(queries[type]) == 'string') {
      run_query(conn, queries[type], function (res) {
        updateRecords(conn, type, table, timestamp_val, function () {
          execute_query(conn, path, final_file_paths, type, cb);
        });
      });
    } else if (typeof(queries[type]) == 'function') {
      queries[type](conn, function() {
        updateRecords(conn, type, table, timestamp_val, function () {
          execute_query(conn, path, final_file_paths, type, cb);
        });
      });
    } else {
      updateRecords(conn, type, table, timestamp_val, function () {
        execute_query(conn, path, final_file_paths, type, cb);
      });
    }

  } else {
    cb();
  }
}

function updateRecords(conn, type, table, timestamp_val, cb) {
  var query = '';
  if (type == 'up') {
    query = "INSERT INTO " + table + " (`timestamp`) VALUES ('" + timestamp_val + "')";
  } else if (type == 'down') {
    query = "DELETE FROM " + table + " WHERE `timestamp` = '" + timestamp_val + "'"
  }

  run_query(conn, query, function (res) {
    cb();
  });
}

module.exports = {
  run_query: run_query,
  execute_query: execute_query,
  updateRecords: updateRecords
};
