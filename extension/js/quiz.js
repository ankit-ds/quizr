let currentQuestionIndex = 0;
let score = 0;
let questionAnswered = false;
let scoreDisplay;
let quizData = null;

// Show loading state
function showLoading(message = 'Generating MCQs...') {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mb-0">${message}</p>
        </div>
    `;
}

// Show error message
function showError(message, retryCallback = null) {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = `
        <div class="alert alert-danger">
            <h4 class="alert-heading">Error</h4>
            <p>${message}</p>
            ${retryCallback ? '<button class="btn btn-danger mt-2" id="retryButton">Try Again</button>' : ''}
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

// Function to get page content and generate MCQs
async function generateMCQs() {
    try {
        showLoading('Extracting page content...');
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message directly to content script
        const extractedData = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: "getPageContent" }, resolve);
        });

        if (!extractedData) {
            throw new Error('Failed to extract content from the page');
        }
        
        if (extractedData.error) {
            throw new Error(extractedData.error);
        }

        showLoading('Generating questions...');

        // Send content to backend API
        const response = await fetch('http://localhost:8000/generate-mcqs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                content: extractedData.content,
                metadata: extractedData.metadata
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to generate MCQs');
        }

        quizData = await response.json();
        
        if (!quizData.questions || quizData.questions.length === 0) {
            throw new Error('No questions could be generated from this content');
        }

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
}

function resetQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    questionAnswered = false;
    quizData = null;
    generateMCQs();
}

function calculateProgress() {
    return ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
}

// Initialize the quiz when the popup opens
document.addEventListener('DOMContentLoaded', () => {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = `
        <div class="text-center">
            <h2 class="h4 fw-bold mb-3">MCQ Generator</h2>
            <p class="text-muted mb-3">Click the button below to generate multiple choice questions from the current page.</p>
            <button class="btn btn-primary" id="generateButton">Generate MCQs</button>
        </div>
    `;
    document.getElementById('generateButton').addEventListener('click', generateMCQs);
}); 