#!/usr/bin/env node

const f = require("./index");

f(require("process").argv[2])
.then(null, function (reason) { console.error(reason); });
