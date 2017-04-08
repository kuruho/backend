#!/bin/sh

NVM_VERSION=0.33.1
NODE_VERSION=6.1.0

curl -o- https://raw.githubusercontent.com/creationix/nvm/v$NVM_VERSION/install.sh | bash
nvm install $NODE_VERSION
nvm use --delete-prefix v$NODE_VERSION

npm install
