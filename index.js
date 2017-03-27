const fs = require("fs");

const AWS = require("aws-sdk");
const cloudformation = new AWS.CloudFormation({ apiVersion: "2010-05-15" });
const ecs = new AWS.ECS({ apiVersion: "2014-11-13" });
const async = require("async");

module.exports = function (stackName) {
	const envFiles = new Map();
	
	return (function listResourcesLoop (nextToken) {
		
		// Get set of stack resources
		return new Promise(function (resolve, reject) {
			const params = { StackName: stackName };
			if (nextToken) params.NextToken = nextToken;
			
			cloudformation.listStackResources(params, function (err, data) {
				if (err) reject(err); else resolve(data);
			});
		})
		.then(function (data) {
			
			// Determine whether to get additional page
			var nextStackResources;
			if (data.NextToken) {
				nextStackResources = listResourcesLoop(data.NextToken);
			}
			else {
				nextStackResources = Promise.resolve(false);
			}
			
			// Filter ones that are ECS task definition resources and describe them
			const taskResourceRequests = [];
			for (let i = 0; i < data.StackResourceSummaries.length; i++) {
				const stackResource = data.StackResourceSummaries[i];
				if (stackResource.ResourceType === "AWS::ECS::TaskDefinition") {
					taskResourceRequests.push(new Promise(function (stackResource, resolve, reject) {
						cloudformation.describeStackResource({
							StackName: stackName,
							LogicalResourceId: stackResource.LogicalResourceId
						}, function (err, data) {
							if (err) reject(err); else resolve(data);
						});
					}.bind(this, stackResource)));
				}
			}
			
			const theseTaskResources = Promise.all(taskResourceRequests)
			.then(function (taskResources) {
				
				// Describe the physical task definitions that have the environment file metadata key
				const taskDefinitionRequests = [];
				for (let i = 0; i < taskResources.length; i++) {
					const taskResource = taskResources[i].StackResourceDetail;
					const metadata = JSON.parse(taskResource.Metadata);
					if (metadata["LWD::EnvironmentFile"]) {
						taskDefinitionRequests.push(new Promise(function (taskResource, envFileMetadata, resolve, reject) {
							ecs.describeTaskDefinition({ taskDefinition: taskResource.PhysicalResourceId }, function (err, data) {
								if (err) reject(err);
								else resolve({
									taskDefinition: data.taskDefinition,
									LogicalResourceId: taskResource.LogicalResourceId,
									Metadata: envFileMetadata
								});
							});
						}.bind(this, taskResource, metadata["LWD::EnvironmentFile"])));
					}
				}
				
				return Promise.all(taskDefinitionRequests);
			})
			.then(function (taskDefinitions) {
				
				// For each environment variable in each container definition in each task definition
				for (let i = 0; i < taskDefinitions.length; i++) {
					const taskResourceName = taskDefinitions[i].LogicalResourceId;
					const metadata = taskDefinitions[i].Metadata;
					const taskDefinition = taskDefinitions[i].taskDefinition;
					
					for (let j = 0; j < taskDefinition.containerDefinitions.length; j++) {
						const container = taskDefinition.containerDefinitions[j];
						const envFile = new Map();
						
						for (let k = 0; k < container.environment.length; k++) {
							const envVar = container.environment[k];
							
							// If the environment file metadata says to use this environment variable
							// Set it in the map for this container's environment file
							if (metadata.Environment[envVar.name]) {
								envFile.set(envVar.name, envVar.value);
							}
						}
						
						envFiles.set(taskResourceName + "_" + container.name + ".env", envFile);
					}
				}
			});
			
			return Promise.all([theseTaskResources, nextStackResources]);
		});
	})()
	.then(function () {
		
		// Write out the environment file for each container
		// Named with the logical task definition name and the container name
		return new Promise(function (resolve, reject) {
			async.each(envFiles.entries(), function (entry, cb) {
				fs.open(entry[0], "w", 0600, function (err, fd) {
					if (err) {
						cb(err); return;
					}
					async.eachSeries(entry[1].entries(), function (entry, cb) {
						fs.write(fd, entry[0] + "=" + entry[1] + "\n", null, "UTF-8", cb);
					}, function (err) {
						if (err) {
							cb(err); return;
						}
						fs.close(fd, cb);
					});
				});
			}, function (err) {
				if (err) reject(err); else resolve();
			});
		});
	});
};
