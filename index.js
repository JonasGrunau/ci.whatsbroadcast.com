const express = require("express");
const app = express();
const exec = require("child_process").exec;

app.use(express.json());

app.get("/", function(request, response) {
	response.send("<pre>404 - Not found</pre>");
});

let repository;

app.post("/invoke", function(request, response) {
	const payload = request.body;
	const pusher = payload.pusher.name;
	const headCommit = payload.head_commit;
	const isMaster = payload.ref === "refs/heads/master";
	repository = payload.repository;

	if (!isMaster) {
		return;
	}

	console.log("GitHub >> Push Event Received");
	console.log("-> Repository: " + repository.name);
	console.log("-> Pusher: " + pusher);
	console.log("-> Commit Comment: " + headCommit["message"]);
	console.log("GitHub >> Starting Deployment Process...");

	run();

	response.send("OK");
});

app.listen(8500, function() {
	console.log("Listening on port 8500!\n");
});

function run() {
	const cd = "cd /var/www/ci.whatsbroadcast.com/tmp/";
	const command = cd + ";rm -r -f *;git clone " + repository.clone_url + ";cd " + repository.name + ";npm install";
	executeCommand(command, function(exitCode) {
		if (exitCode === 0) {
			runTests();
		}
	});
}

function runTests() {
	const cd = "cd /var/www/ci.whatsbroadcast.com/tmp/" + repository.name;
	const command = cd + ";npm test";
	executeCommand(command, function(exitCode) {
		if (exitCode === 0) {
			build();
		}
	});
}

function build() {
	const cd = "cd /var/www/ci.whatsbroadcast.com/tmp/" + repository.name;
	const command = cd + ";npm run-script build";
	executeCommand(command, function(exitCode) {
		if (exitCode === 0) {
			backup();
		}
	});
}

function backup() {
	const folderName = "backup_" + Date.now();
	const production = "/var/www/phoenix.whatsbroadcast.com/build/";
	const command = "mkdir /var/www/phoenix_backup/" + folderName + ";cp -rf " + production + "* /var/www/phoenix_backup/" + folderName + "/";
	executeCommand(command, function(exitCode) {
		if (exitCode === 0) {
			deploy();
		}
	});
}

function deploy() {
	const production = "/var/www/phoenix.whatsbroadcast.com/build/";
	const tmp = "/var/www/ci.whatsbroadcast.com/tmp/" + repository.name + "/build/";
	const command = "cp -rf " + tmp + "* " + production;
	executeCommand(command, function(exitCode) {
		if (exitCode === 0) {
			console.log("Deployment Successful!");
		}
	});
}

function executeCommand(command, callback) {
	console.log("Executing Command: " + command);

	const execution = exec(command, function(error, stdout, stderr) {
		if (error) {
			console.log(error);
		}
		console.log(stdout);
	});

	execution.on("exit", function(code) {
		console.log("Exited with code " + code);
		if (code !== 0) {
			console.log("Success!");
		}
		callback(code);
	});
}
