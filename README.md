# cloudformation-env-file
Creates an environment file for Docker Compose using Cloudformation stack resources

The command looks for task definitions in the stack that have a specific metadata key indicating which environment variables from the container definitions should be used.

## Usage
```
npm install -g "@lwd/cloudformation-env-file"
cd /path/to/project
cloudformation-env-file stack-name
```

### Example docker-compose.yml
```yaml
version: '2'
services:
  App:
    env_file: task-logical-resource-id_container-name.env
...
```

### Example CloudFormation template (resources section)
```json
{
  "task": {
    "Type": "AWS::ECS::TaskDefinition",
    "Metadata": {
      "LWD::EnvironmentFile": {
        "Environment": {
          "MY_ENV_VAR": true
        }
      }
    },
    "Properties": {
    }
  }
}
```
