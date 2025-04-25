// This script runs in the context of web pages
// It can interact with the web page's DOM

// Check if required libraries are available
function checkLibrariesLoaded() {
    if (typeof Readability === 'undefined') {
        console.error('Readability library is not loaded');
        return false;
    }
    if (typeof DOMPurify === 'undefined') {
        console.error('DOMPurify library is not loaded');
        return false;
    }
    return true;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === "getPageContent") {
        try {
            // Check if required libraries are loaded
            if (!checkLibrariesLoaded()) {
                sendResponse({
                    error: "Required libraries are not loaded. Please refresh the page or reinstall the extension."
                });
                return true;
            }
            
            console.log('Attempting to extract content from the page...');
            
            // Create a clone of the document
            const documentClone = document.cloneNode(true);
            
            if (!documentClone) {
                sendResponse({
                    error: "Failed to clone document"
                });
                return true;
            }
            
            console.log('Document cloned successfully');
            
            // Create a new Readability object
            const reader = new Readability(documentClone);
            
            console.log('Readability instance created');
            
            // Parse the content
            const article = reader.parse();
            
            console.log('Article parsing result:', article ? 'Success' : 'Failed');
            
            if (!article) {
                sendResponse({ 
                    error: "Could not extract content from this page. The page might not contain extractable article content."
                });
                return true;
            }

            // Combine title and content
            let extractedContent = article.title + "\n\n" + article.textContent;
            
            console.log('Content extracted, length:', extractedContent.length);
            
            // Sanitize the content
            const sanitizedContent = DOMPurify.sanitize(extractedContent, {
                ALLOWED_TAGS: [], // Strip all HTML tags
                ALLOWED_ATTR: [] // Strip all attributes
            });

            // Remove extra whitespace and normalize line breaks
            const cleanContent = sanitizedContent
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n\n')
                .trim();
                
            console.log('Content cleaned, final length:', cleanContent.length);
            
            // If content is too short, return an error
            if (cleanContent.length < 100) {
                sendResponse({
                    error: "Extracted content is too short to generate meaningful questions"
                });
                return true;
            }

            sendResponse({ 
                success: true,
                content: cleanContent,
                metadata: {
                    title: article.title,
                    excerpt: article.excerpt,
                    byline: article.byline,
                    length: cleanContent.length
                }
            });
            
            console.log('Content successfully sent to extension');
        } catch (error) {
            console.error('Content extraction error:', error);
            sendResponse({ 
                error: "Failed to extract content: " + error.message 
            });
        }
    } else if (request.action === "testConnection") {
        // Simple action to test if content script is properly injected
        sendResponse({ success: true, message: "Content script is working" });
    }
    return true;
}); 