var fs = require("fs");

var coreFunctions  = require('./core_functions');
var queryFunctions  = require('./query');

var config = require('./config');
var table = config['table'];
var migrations_types = config['migrations_types'];

function migration(container, path, cb) {
  if(cb == null)
    cb = () => {};

  queryFunctions.run_query(container, "CREATE TABLE IF NOT EXISTS `" + table + "` (`timestamp` varchar(254) NOT NULL UNIQUE)", function (res) {
    handle(process.argv, container, path, cb);
  });
}

function execute(argv, container, path, cb) {
  if(cb == null)
    cb = () => {};

  argv = argv.slice(0);
  argv.unshift('', ''); // 先頭に2つ要素を追加

  queryFunctions.run_query(container, "CREATE TABLE IF NOT EXISTS `" + table + "` (`timestamp` varchar(254) NOT NULL UNIQUE)", function (res) {
    handle(argv, container, path, cb);
  });
}

function handle(argv, container, path, cb) {
  if (argv.length > 2 && argv.length <= 6) {
    if (argv[2] == 'add' && (argv[3] == 'migration' || argv[3] == 'seed')) {
      coreFunctions.add_migration(argv, path, function () {
        cb();
      });
    } else if (argv[2] == 'up') {
      var count = null;
      if (argv.length > 3) {
        count = parseInt(argv[3]);
      } else {
        count = 999999;
      }
      coreFunctions.up_migrations(container, count, path, function () {
        cb();
      });
    } else if (argv[2] == 'down') {
      var count = null;
      if (argv.length > 3) {
        count = parseInt(argv[3]);
      } else count = 1;
      coreFunctions.down_migrations(container, count, path, function () {
        cb();
      });
    } else if (argv[2] == 'down-skip') {
      var count = null;
      if (argv.length > 3) {
        count = parseInt(argv[3]);
      } else count = 1;
      coreFunctions.down_skip_migrations(container, count, path, function () {
        cb();
      });
    } else if (argv[2] == 'refresh') {
      coreFunctions.down_migrations(container, 999999, path, function () {
        coreFunctions.up_migrations(container, 999999, path, function () {
          cb();
        });
      });
    } else if (argv[2] == 'run' && migrations_types.indexOf(argv[4]) > -1) {
      coreFunctions.run_migration_directly(argv[3], argv[4], container, path, function () {
        cb();
      });
    } else if (argv[2] == 'set') {
      var timestamp_val = argv[3] || 0;
      if (10 === String(timestamp_val).length) {
        timestamp_val += '000';
      }
      coreFunctions.set_migrations(container, timestamp_val, path, function () {
        cb();
      });
    } else {
      throw new Error('command not found : ' + argv.join(" "));
    }
  } else {
    throw new Error('command not found : ' + argv.join(" "));
  }
}

module.exports = {
  init: migration,
  execute
}
