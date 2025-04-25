#!/bin/bash

# Create directory if it doesn't exist
mkdir -p "$(dirname "$0")"

# Download DOMPurify
curl -L https://raw.githubusercontent.com/cure53/DOMPurify/main/dist/purify.min.js -o "$(dirname "$0")/purify.min.js"

# Download Readability
curl -L https://raw.githubusercontent.com/mozilla/readability/master/Readability.js -o "$(dirname "$0")/Readability.js"

echo "Libraries downloaded successfully!" 