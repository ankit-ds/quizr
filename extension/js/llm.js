// LLM API handling for MCQ Generator

class LLMClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.questionModel = "gpt-4o";
        this.summarizationModel = "gpt-4o-mini";
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    // Store API key in Chrome storage
    async saveApiKey(apiKey) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    this.apiKey = apiKey;
                    resolve();
                }
            });
        });
    }

    // Retrieve API key from Chrome storage
    async getApiKey() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get('openaiApiKey', (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    this.apiKey = result.openaiApiKey || '';
                    resolve(this.apiKey);
                }
            });
        });
    }

    // Call the OpenAI API to summarize the content
    async summarizeContent(content) {
        if (window.MCQUtils) {
            MCQUtils.debugLog('LLMClient', 'Summarizing content', { 
                contentLength: content.length
            });
        }
        
        if (!this.apiKey) {
            throw new Error("OpenAI API key is not set. Please set it in the extension settings.");
        }

        const summarizationPrompt = `
Task: Information Extraction for Question Generation
As a highly skilled AI, your expertise lies in meticulously analyzing text to identify and extract pivotal sentences. Your task involves the following steps:
1. Read the provided text thoroughly.
2. Identify and extract maximum 5 most crucial sentences. These sentences should encapsulate the core facts, findings, or themes that are fundamental to the text's overall meaning.
3. Focus on clarity and conciseness. The extracted sentences should be self-contained and comprehensive, enabling the straightforward formulation of questions.
4. Ensure accuracy and relevance. The sentences selected should accurately represent the text's main ideas and be directly related to its central discussion.
5. Present the extracted sentences in a clear, organized manner, suitable for subsequent question development.
Your role is crucial in distilling the essence of the text into concise, informative segments that can serve as the basis for meaningful and relevant questions.

TEXT TO ANALYZE:
${content}`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.summarizationModel,
                    messages: [
                        { role: "user", content: summarizationPrompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || 'Failed to summarize content'}`);
            }

            const data = await response.json();
            const summary = data.choices[0].message.content;
            
            if (window.MCQUtils) {
                MCQUtils.debugLog('LLMClient', 'Summary generated successfully', { 
                    summaryLength: summary.length
                });
            }
            
            return summary;
        } catch (error) {
            if (window.MCQUtils) {
                MCQUtils.debugLog('LLMClient', 'Error summarizing content', { error });
            }
            console.error('Error summarizing content:', error);
            throw new Error(`Failed to generate summary: ${error.message}`);
        }
    }

    // Call the OpenAI API to generate MCQs
    async generateQuestions(summary) {
        if (window.MCQUtils) {
            MCQUtils.debugLog('LLMClient', 'Generating questions', { 
                summaryLength: summary.length
            });
        }
        
        if (!this.apiKey) {
            throw new Error("OpenAI API key is not set. Please set it in the extension settings.");
        }

        const questionsPrompt = `Create multiple choice questions based on this text:

"${summary}"

Format your response as a JSON array of question objects. Each question object should have these fields:
- question: the question text
- options: an object with keys A, B, C, D and their option text values
- answer: the letter of the correct option (A, B, C, or D)
- related_sentence: the sentence from the original text that the question is based on

IMPORTANT: Your entire response must be a valid JSON array that can be parsed by json.loads().
Example:
{
   "questions": [
       {
           "question": "What is being released by the PlayStation parent as part of the celebration?",
           "options": {
               "A": "The Dark Odyssey armour set",
               "B": "The Dark Odyssey Collection",
               "C": "God of War Ragnarök",
               "D": "God of War III Remastered"
           },
           "answer": "B",
           "related_sentence": "PlayStation parent is releasing the Dark Odyssey Collection for the latest game in the series."
       }
       ]
}`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.questionModel,
                    messages: [
                        { role: "system", content: "You are a helpful assistant that creates multiple choice questions in perfect JSON format." },
                        { role: "user", content: questionsPrompt }
                    ],
                    temperature: 1,
                    max_tokens: 2000,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || 'Failed to generate questions'}`);
            }

            const data = await response.json();
            const mcqJson = data.choices[0].message.content;
            
            try {
                const mcqData = JSON.parse(mcqJson);
                
                if (Array.isArray(mcqData)) {
                    if (window.MCQUtils) {
                        MCQUtils.debugLog('LLMClient', 'Questions generated successfully', { 
                            count: mcqData.length
                        });
                    }
                    return mcqData;
                } else if (mcqData.questions && Array.isArray(mcqData.questions)) {
                    if (window.MCQUtils) {
                        MCQUtils.debugLog('LLMClient', 'Questions generated successfully', { 
                            count: mcqData.questions.length
                        });
                    }
                    return mcqData.questions;
                } else {
                    throw new Error("Unexpected response format from OpenAI API");
                }
            } catch (error) {
                console.error("Failed to parse MCQ response:", error);
                throw new Error("Failed to parse the generated questions");
            }
        } catch (error) {
            if (window.MCQUtils) {
                MCQUtils.debugLog('LLMClient', 'Error generating questions', { error });
            }
            console.error('Error generating questions:', error);
            throw new Error(`Failed to generate questions: ${error.message}`);
        }
    }

    // Generate MCQs from the given content
    async generateMCQs(content) {
        try {
            // Step 1: Summarize the content
            const summary = await this.summarizeContent(content);
            
            // Step 2: Generate MCQs from the summary
            const questions = await this.generateQuestions(summary);
            
            return { questions };
        } catch (error) {
            console.error("Error generating MCQs:", error);
            throw error;
        }
    }
}

// Export the LLMClient class
window.LLMClient = LLMClient; 