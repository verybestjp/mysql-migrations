var table = require('./config')['table'];

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
        return cb(error);
      }
    }
    if (query.length > 0) {
      return run_query(container, query, cb);
    }
    return cb(null, results);
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
      const real_type = type.replace('_force', '');
      if (typeof(queries[real_type]) === 'function') {
        return queries[real_type](container);
      }
      return queries[real_type];
    }).then((result) => {
      queries[type] = result;

      if (Array.isArray(queries[type])) {
        let query = queries[type].slice(0);
        if (['up_force', 'down_force'].includes(type)) {
          query = query.map(it => it[0] !== '@' ? '@' + it : it );
        }
        run_query(container, query, function (error, res) {
          if (error) {
            return cb(error);
          }
          updateRecords(container, type, table, timestamp_val, function () {
            execute_query(container, path, final_file_paths, type, cb);
          });
        });
      } else if (typeof(queries[type]) == 'string') {
        let query = queries[type];
        if (['up_force', 'down_force'].includes(type)) {
          query = query[0] !== '@' ? '@' + query : query;
        }
        run_query(container, query, function (error, res) {
          if (error) {
            return cb(error);
          }
          updateRecords(container, type, table, timestamp_val, function () {
            execute_query(container, path, final_file_paths, type, cb);
          });
        });
      } else {
        updateRecords(container, type, table, timestamp_val, function () {
          execute_query(container, path, final_file_paths, type, cb);
        });
      }
    }).catch(err => {
      cb(err);
    });
  } else {
    cb();
  }
}

function updateRecords(container, type, table, timestamp_val, cb) {
  var query = '';
  var query2 = '';
  if (['up', 'up_force'].includes(type)) {
    query = "INSERT INTO " + table + " (`timestamp`) VALUES ('" + timestamp_val + "')";
    if ('up_force') {
      query = '@' + query;
    }
    run_query(container, query, function (error, res) {
      cb(error, res);
    });
  } else if (['down', 'down_force'].includes(type)) {
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
    if ('down_force') {
      query = '@' + query;
    }

    run_query(container, query, function (error, res) {
      cb(error, res);
    });
  } else if (type == 'set') {
    query = "DELETE FROM " + table;
    run_query(container, query, function (error, res) {
      if (error) {
        return cb(error);
      }
      if (!Array.isArray(timestamp_val)) {
        return cb();
      }
      timestamp_val = timestamp_val.filter(function (x, i, a) { // array unique
        return a.indexOf(x) == i;
      });
      timestamp_val = timestamp_val.map((it) => {
        return '("' + it + '")';
      });
      query2 = "INSERT INTO " + table + " (`timestamp`) VALUES " + timestamp_val.join(',');

      run_query(container, query2, function (error, res) {
        cb(error, res);
      });
    });
  }
}

module.exports = {
  run_query: run_query,
  execute_query: execute_query,
  updateRecords: updateRecords
};
