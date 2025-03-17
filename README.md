# MCQ Extension

A Chrome extension that extracts webpage content and generates multiple-choice questions (MCQs) using a FastAPI backend and the Groq API.

## Project Structure

The project consists of two main components:

1. **Chrome Extension**
   - Located in the `extension/` directory
   - Features a popup interface for user interaction
   - Extracts and cleans webpage content
   - Sends content to the backend for MCQ generation
   - Displays generated MCQs to the user

2. **FastAPI Backend**
   - Receives webpage content from the extension
   - Processes content using the Groq API
   - Returns generated MCQs in JSON format

## Backend Setup

### Prerequisites

- Python 3.8+
- FastAPI
- Groq API Key

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd mcqExtension
   ```

2. Create and activate a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

   Key dependencies:
   - fastapi==0.103.1
   - uvicorn==0.23.2
   - httpx==0.25.0
   - python-dotenv==1.0.0
   - pydantic==2.3.0

4. Create a `.env` file with your Groq API key:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```

### Running the API

Start the FastAPI server:
```
python app.py
```

The API will be available at `http://localhost:8000`.

### API Endpoints

- `GET /`: Check if the API is running
- `POST /generate-mcqs`: Generate MCQs from webpage content

#### Request Format (POST /generate-mcqs)

```json
{
  "content": "The webpage content goes here..."
}
```

#### Response Format

```json
{
  "questions": [
    {
      "question": "What is the capital of France?",
      "options": {
        "A": "Berlin",
        "B": "Madrid",
        "C": "Paris",
        "D": "Rome"
      },
      "answer": "C",
      "related_sentence": "Paris is the capital of France."
    },
    // More questions...
  ]
}
```

## Chrome Extension Setup

### Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` directory from this project

### Features

The extension includes:
- Popup interface for user interaction
- Content extraction from active webpage
- MCQ generation and display
- Responsive design with custom styling

### Directory Structure

```
extension/
├── css/         # Styling files
├── js/          # JavaScript functionality
├── images/      # Extension icons and assets
├── popup.html   # Extension popup interface
└── manifest.json # Extension configuration
```

### Testing

Run the test script to verify the API functionality:
```
python test_api.py
```

## License

[MIT License](LICENSE)