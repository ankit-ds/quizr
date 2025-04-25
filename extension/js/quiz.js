let currentQuestionIndex = 0;
let score = 0;
let questionAnswered = false;
let scoreDisplay;
let quizData = null;
let llmClient = null;

// Save quiz state to Chrome storage
function saveQuizState() {
    if (quizData) {
        chrome.storage.local.set({
            'mcq_quiz_state': {
                currentQuestionIndex,
                score,
                questionAnswered,
                quizData
            }
        });
    }
}

// Load quiz state from Chrome storage
async function loadQuizState() {
    return new Promise((resolve) => {
        chrome.storage.local.get('mcq_quiz_state', (result) => {
            if (result.mcq_quiz_state) {
                currentQuestionIndex = result.mcq_quiz_state.currentQuestionIndex;
                score = result.mcq_quiz_state.score;
                questionAnswered = result.mcq_quiz_state.questionAnswered;
                quizData = result.mcq_quiz_state.quizData;
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

// Clear quiz state from storage
function clearQuizState() {
    chrome.storage.local.remove('mcq_quiz_state');
}

// Show loading state with vertical stepper progress indicator
function showLoading(message = 'Generating MCQs...') {
    // Log the progress
    if (window.MCQUtils) {
        MCQUtils.debugLog('QuizUI', message);
    }
    
    const quizContainer = document.getElementById('quiz-container');
    
    // Determine the progress step based on the message
    let currentStep = 0;
    
    if (message.includes('Preparing') || message.includes('Initializing')) {
        currentStep = 1;
    } else if (message.includes('Extracting')) {
        currentStep = 2;
    } else if (message.includes('Analyzing') || message.includes('summary')) {
        currentStep = 3;
    } else if (message.includes('Creating') || message.includes('questions')) {
        currentStep = 4;
    }
    
    // Define the steps
    const steps = [
        { id: 1, label: 'Initializing', description: 'Setting up the process' },
        { id: 2, label: 'Extracting', description: 'Getting content from page' },
        { id: 3, label: 'Analyzing', description: 'Processing content' },
        { id: 4, label: 'Creating', description: 'Generating questions' }
    ];
    
    // Generate the stepper HTML
    let stepperHtml = '<div class="stepper-container p-3">';
    
    steps.forEach(step => {
        // Determine status: completed, active, or pending
        const status = step.id < currentStep ? 'completed' : 
                     (step.id === currentStep ? 'active' : 'pending');
        
        // Circle icon class
        const circleClass = status === 'completed' ? 'bg-primary text-white' : 
                          (status === 'active' ? 'bg-primary text-white' : 'bg-light text-secondary');
                          
        // Line class (connecting to next step)
        const lineClass = status === 'completed' ? 'bg-primary' : 
                        (status === 'active' ? 'bg-primary active-line' : 'bg-secondary');
                        
        // Text class
        const textClass = status === 'completed' || status === 'active' ? 'text-dark' : 'text-secondary';
        
        // Icon based on status: checkmark for completed, spinner for active, empty for pending
        let icon = '';
        if (status === 'completed') {
            icon = '<i class="bi bi-check"></i>';
        } else if (status === 'active') {
            icon = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div>';
        }
        
        // Generate step HTML
        stepperHtml += `
            <div class="step d-flex mb-3">
                <div class="step-indicator me-3">
                    <div class="circle ${circleClass} rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; font-size: 16px;">
                        ${icon}
                    </div>
                    ${step.id < steps.length ? `<div class="line ${lineClass}" style="height: 30px;"></div>` : ''}
                </div>
                <div class="step-content">
                    <div class="step-title ${textClass} fw-bold">${step.label}</div>
                    <div class="step-description small text-muted">${step.description}</div>
                    ${step.id === currentStep ? `<div class="current-action text-primary small mt-1">${message}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    stepperHtml += '</div>';
    
    quizContainer.innerHTML = stepperHtml;
}

// Show error message
function showError(message, retryCallback = null) {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = `
        <div class="alert alert-danger">
            <h4 class="alert-heading">Error</h4>
            <p>${message}</p>
            ${retryCallback ? '<button class="btn btn-danger mt-2" id="retryButton">Try Again</button>' : ''}
            ${message.includes('API key') ? '<a href="settings.html" class="btn btn-primary mt-2">Set API Key</a>' : ''}
        </div>
    `;
    
    if (retryCallback) {
        document.getElementById('retryButton').addEventListener('click', () => {
            if (typeof retryCallback === 'string') {
                window[retryCallback.replace('()', '')]();
            } else {
                retryCallback();
            }
        });
    }
}

// Check if content script is properly injected
async function testContentScript(tabId) {
    try {
        console.log('Testing connection to content script...');
        const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: "testConnection" }, (result) => {
                if (chrome.runtime.lastError) {
                    resolve({ error: chrome.runtime.lastError.message });
                } else {
                    resolve(result || { error: "No response from content script" });
                }
            });
        });
        
        console.log('Test connection response:', response);
        
        if (response && response.success) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error testing content script:', error);
        return false;
    }
}

// Inject content script manually if needed
async function injectContentScript(tabId) {
    try {
        console.log('Injecting content script manually...');
        await chrome.scripting.executeScript({
            target: { tabId },
            files: [
                'js/lib/purify.min.js',
                'js/lib/Readability.js',
                'js/content.js'
            ]
        });
        return true;
    } catch (error) {
        console.error('Error injecting content script:', error);
        return false;
    }
}

// Check if API key is set
async function checkApiKey() {
    try {
        await llmClient.getApiKey();
        if (!llmClient.apiKey) {
            showError("OpenAI API key is not set. Please set it in the settings.", null);
            return false;
        }
        return true;
    } catch (error) {
        showError("Failed to get API key: " + error.message, null);
        return false;
    }
}

// Function to get page content and generate MCQs
async function generateMCQs() {
    try {
        // Initialize LLM client if not already initialized
        if (!llmClient) {
            llmClient = new LLMClient();
        }
        
        // Check if API key is set
        const apiKeyValid = await checkApiKey();
        if (!apiKeyValid) {
            return;
        }
        
        showLoading('Initializing process...');
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            throw new Error('No active tab found. Please refresh and try again.');
        }
        
        console.log('Active tab:', tab.url);
        
        // Test connection to content script
        let contentScriptWorking = await testContentScript(tab.id);
        
        // If content script is not working, try to inject it manually
        if (!contentScriptWorking) {
            console.log('Content script not responding, attempting to inject manually...');
            showLoading('Preparing to extract content...');
            const injectionSuccess = await injectContentScript(tab.id);
            
            if (injectionSuccess) {
                // Test again after injection
                contentScriptWorking = await testContentScript(tab.id);
            }
            
            if (!contentScriptWorking) {
                throw new Error('Failed to initialize content script. Please refresh the page and try again.');
            }
        }
        
        showLoading('Extracting content from webpage...');
        
        // Send message to content script
        const extractedData = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: "getPageContent" }, (result) => {
                if (chrome.runtime.lastError) {
                    resolve({ error: chrome.runtime.lastError.message });
                } else {
                    resolve(result || { error: "No response from content script" });
                }
            });
        });

        console.log('Extraction result:', extractedData);

        if (!extractedData) {
            throw new Error('Failed to extract content from the page. No response received.');
        }
        
        if (extractedData.error) {
            throw new Error(extractedData.error);
        }
        
        if (!extractedData.content || extractedData.content.trim().length < 100) {
            throw new Error('Extracted content is too short to generate meaningful questions. Please try a different page with more text content.');
        }

        // Step 1: First show message for summarizing content
        showLoading('Analyzing content with GPT-4o mini...');
        
        // Get the summary
        const summary = await llmClient.summarizeContent(extractedData.content);
        
        // Step 2: Now show message for generating questions
        showLoading('Creating multiple choice questions with GPT-4o...');

        // Generate MCQs using the summary
        const questions = await llmClient.generateQuestions(summary);
        
        quizData = { questions };
        
        if (!quizData.questions || quizData.questions.length === 0) {
            throw new Error('No questions could be generated from this content. Please try a different page.');
        }

        // Reset state for new quiz
        currentQuestionIndex = 0;
        score = 0;
        questionAnswered = false;
        
        // Save quiz state
        saveQuizState();
        createQuiz();

    } catch (error) {
        console.error('Error:', error);
        showError(error.message, 'generateMCQs');
    }
}

function createQuiz() {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = '';

    // Progress Bar
    const progressBar = document.createElement('div');
    progressBar.className = 'progress mb-4';
    progressBar.innerHTML = `
        <div class="progress-bar progress-bar-striped" role="progressbar" style="width: ${calculateProgress()}%" aria-valuenow="${calculateProgress()}" aria-valuemin="0" aria-valuemax="100"></div>
    `;
    quizContainer.appendChild(progressBar);

    const question = quizData.questions[currentQuestionIndex];

    // Question Element
    const questionEl = document.createElement('div');
    questionEl.className = 'mb-3';
    questionEl.innerHTML = `
        <h2 class="h6 fw-bold mb-3">${currentQuestionIndex + 1}. ${question.question}</h2>
        <div id="options-container" class="mb-2 border-bottom"></div>
        <p id="related-sentence" class="mt-2 d-none"></p>
    `;
    quizContainer.appendChild(questionEl);

    // Options
    const optionsContainer = document.getElementById('options-container');
    Object.entries(question.options).forEach(([key, value]) => {
        const optionEl = document.createElement('button');
        optionEl.className = 'btn btn-light w-100 mb-1 text-start';
        optionEl.textContent = `${key}: ${value}`;
        optionEl.onclick = () => selectAnswer(optionEl, key, question.answer, question.related_sentence);
        optionsContainer.appendChild(optionEl);
    });

    addNavigationButtons(quizContainer);
}

function selectAnswer(optionEl, selectedOption, correctAnswer, relatedSentence) {
    if (questionAnswered) return;

    const optionsContainer = optionEl.parentNode;
    optionsContainer.childNodes.forEach(node => {
        node.disabled = true;
        node.classList.add('disabled');
    });

    if (selectedOption === correctAnswer) {
        optionEl.classList.remove('btn-light');
        optionEl.classList.add('btn-success');
        score++;
        
        // Show success feedback
        const feedback = document.createElement('div');
        feedback.className = 'alert alert-success mt-2';
        feedback.textContent = 'Correct!';
        optionsContainer.parentNode.insertBefore(feedback, optionsContainer.nextSibling);
    } else {
        optionEl.classList.remove('btn-light');
        optionEl.classList.add('btn-danger');
        const correctOption = Array.from(optionsContainer.childNodes)
            .find(node => node.textContent.startsWith(correctAnswer));
        correctOption.classList.remove('btn-light');
        correctOption.classList.add('btn-success');
        
        // Show error feedback
        const feedback = document.createElement('div');
        feedback.className = 'alert alert-danger mt-2';
        feedback.textContent = 'Incorrect. Try to remember this for next time!';
        optionsContainer.parentNode.insertBefore(feedback, optionsContainer.nextSibling);
    }

    // Show explanation with animation
    const relatedSentenceEl = document.getElementById('related-sentence');
    relatedSentenceEl.innerHTML = `
        <div class="alert alert-info mt-3">
            <strong>Explanation:</strong><br>
            ${relatedSentence}
        </div>
    `;
    relatedSentenceEl.classList.remove('d-none');
    relatedSentenceEl.style.opacity = '0';
    setTimeout(() => {
        relatedSentenceEl.style.transition = 'opacity 0.5s ease-in';
        relatedSentenceEl.style.opacity = '1';
    }, 100);

    questionAnswered = true;
    updateScoreDisplay();
    
    // Save state after answering
    saveQuizState();
}

function addNavigationButtons(quizContainer) {
    const navContainer = document.createElement('div');
    navContainer.className = 'd-flex justify-content-between align-items-center mt-3';

    const backButton = document.createElement('button');
    backButton.textContent = 'Back';
    backButton.className = 'btn btn-secondary';
    backButton.disabled = currentQuestionIndex === 0;
    backButton.onclick = () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            questionAnswered = false;
            createQuiz();
            saveQuizState();
        }
    };

    scoreDisplay = document.createElement('span');
    updateScoreDisplay();

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = 'btn btn-primary';
    nextButton.onclick = () => {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            currentQuestionIndex++;
            questionAnswered = false;
            createQuiz();
            saveQuizState();
        } else {
            displayResults();
        }
    };

    navContainer.appendChild(backButton);
    navContainer.appendChild(scoreDisplay);
    navContainer.appendChild(nextButton);
    quizContainer.appendChild(navContainer);
}

function updateScoreDisplay() {
    if (scoreDisplay) {
        scoreDisplay.textContent = `Score: ${score}/${quizData.questions.length}`;
    }
}

function displayResults() {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = `
        <div class="text-center">
            <h2 class="h4 fw-bold mb-3">Quiz Completed!</h2>
            <p class="lead">Your final score: ${score} / ${quizData.questions.length}</p>
            <button class="btn btn-primary" id="resetButton">Generate New Quiz</button>
        </div>
    `;
    document.getElementById('resetButton').addEventListener('click', resetQuiz);
    
    // Clear quiz state when displaying results
    clearQuizState();
}

function resetQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    questionAnswered = false;
    quizData = null;
    clearQuizState();
    generateMCQs();
}

function calculateProgress() {
    return ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
}

// Initialize the quiz when the popup opens
document.addEventListener('DOMContentLoaded', async () => {
    const quizContainer = document.getElementById('quiz-container');
    
    // Initialize LLM client
    llmClient = new LLMClient();
    
    // Try to load saved quiz state
    const hasState = await loadQuizState();
    
    if (hasState && quizData && quizData.questions && quizData.questions.length > 0) {
        // Resume existing quiz
        createQuiz();
    } else {
        // Show initial screen if no state exists
        quizContainer.innerHTML = `
            <div class="text-center">
                <h2 class="h4 fw-bold mb-3">MCQ Generator</h2>
                <p class="text-muted mb-3">Click the button below to generate multiple choice questions from the current page.</p>
                <button class="btn btn-primary" id="generateButton">Generate MCQs</button>
            </div>
        `;
        document.getElementById('generateButton').addEventListener('click', generateMCQs);
    }
}); 