# MCQ Generator Chrome Extension

A Chrome extension that generates multiple-choice questions (MCQs) from webpage content. The extension utilizes OpenAI's GPT-4o API to create contextually relevant questions, helping users test their understanding of the material they're reading.

## Features

- Extract content from any webpage
- Generate multiple-choice questions based on the content
- Uses GPT-4o mini for content summarization and GPT-4o for question generation
- Interactive quiz interface with instant feedback
- Score tracking and progress indicators
- Explanation for each question
- Configurable OpenAI API settings

## How It Works

1. The extension extracts content from the current webpage using Mozilla's Readability.js
2. Content is summarized using GPT-4o mini
3. GPT-4o generates multiple-choice questions based on the summarized content
4. Questions are presented to the user in an interactive quiz format

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store
2. Search for "MCQ Generator"
3. Click "Add to Chrome"

### Manual Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `extension` folder from this repository

## Setup

After installing the extension, you'll need to provide your own OpenAI API key:

1. Click the extension icon in your browser toolbar
2. Click the settings icon (⚙️) in the top right corner
3. Enter your OpenAI API key and select your preferred model
4. Click "Save Settings"

You can get an OpenAI API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Usage

1. Navigate to any webpage with content you want to test yourself on
2. Click the extension icon in your browser toolbar
3. Click "Generate MCQs"
4. Answer the questions and see your results!

## Technical Details

- Built with vanilla JavaScript
- Uses Mozilla's Readability.js for content extraction
- Leverages OpenAI's GPT-4o models for AI processing
- Bootstrap 5 for UI components

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Privacy

This extension:
- Stores your OpenAI API key locally in your browser
- Sends webpage content to OpenAI's API for processing
- Does not collect or store any user data

Your API key and content are transmitted directly from your browser to OpenAI. No data is sent to our servers.
