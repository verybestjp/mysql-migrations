var table = require('./config')['table'];
var fileFunctions  = require('./file');

function run_query(container, query, cb) {
  if (!Array.isArray(query)) {
    query = [query];
  }
  if (0 === query.length || !query[0]) {
    return cb();
  }
  var query_it = String(query.shift()).trim();
  if (process.env.VERBOSE) {
    console.log(query_it);
  }
  let ignore_error = false;
  if ('@' === query_it[0]) {
    ignore_error = true;
    query_it = query_it.substr(1);
  }
  var conn = container.conn;
  conn.query(query_it, function (error, results, fields) {
    if (error) {
      if (!ignore_error) {
        throw error;
      }
    }
    if (query.length > 0) {
      run_query(container, query, cb);
      return;
    }
    cb(results);
  });
}

function execute_query(container, path, final_file_paths, type, cb) {
  if (final_file_paths.length) {
    var file_name = final_file_paths.shift()['file_path'];
    var current_file_path = path + "/" + file_name;

    var queries = Object.assign({}, require(current_file_path));
    var timestamp_val = file_name.split("_", 1)[0];

    if (process.env.VERBOSE) {
      console.log(`### execute file: run ${file_name} ${type}`);
    }

    Promise.resolve().then(() => {
      if (typeof(queries[type]) === 'function') {
        return queries[type](container);
      }
      return queries[type];
    }).then((result) => {
      queries[type] = result;

      if (Array.isArray(queries[type])) {
        run_query(container, queries[type].slice(0), function (res) {
          updateRecords(container, type, table, timestamp_val, function () {
            execute_query(container, path, final_file_paths, type, cb);
          });
        });
      } else if (typeof(queries[type]) == 'string') {
        run_query(container, queries[type], function (res) {
          updateRecords(container, type, table, timestamp_val, function () {
            execute_query(container, path, final_file_paths, type, cb);
          });
        });
      } else {
        updateRecords(container, type, table, timestamp_val, function () {
          execute_query(container, path, final_file_paths, type, cb);
        });
      }
    });
  } else {
    cb();
  }
}

function updateRecords(container, type, table, timestamp_val, cb) {
  var query = '';
  var query2 = '';
  if (type == 'up') {
    query = "INSERT INTO " + table + " (`timestamp`) VALUES ('" + timestamp_val + "')";

    run_query(container, query, function (res) {
      cb();
    });
  } else if (type == 'down') {
    let timestampList;
    if (!Array.isArray(timestamp_val)){
      timestampList = [timestamp_val];
    } else {
      timestampList = timestamp_val;
    }
    timestampList = timestampList.map((it) => {
      return '"' + it + '"';
    });
    query = "DELETE FROM " + table + " WHERE `timestamp` in (" + timestampList.join(',') + ")";

    run_query(container, query, function (res) {
      cb();
    });
  } else if (type == 'set') {
    query = "DELETE FROM " + table;
    run_query(container, query, function (res) {
      if (!Array.isArray(timestamp_val)) {
        return cb();
      }
      timestamp_val = timestamp_val.filter(function (x, i, a) { // array unique
        return a.indexOf(x) == i;
      });
      timestamp_val = timestamp_val.map((it) => {
        return '("' + it + '")';
      });
      query2 = "INSERT INTO " + table + " VALUES " + timestamp_val.join(',');

      run_query(container, query2, function (res) {
        cb();
      });
    });
  }
}

module.exports = {
  run_query: run_query,
  execute_query: execute_query,
  updateRecords: updateRecords
};
