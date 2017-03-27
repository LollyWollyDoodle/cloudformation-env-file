# cloudformation-env-file
Creates an environment file for Docker Compose using Cloudformation stack resources

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
