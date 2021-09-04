#!/bin/bash

set -e

cd app
echo "start link"
npm link gulp

echo "gulp sass"
gulp sass
echo "gulp js"
gulp js

echo "starting server"
gulp serve
