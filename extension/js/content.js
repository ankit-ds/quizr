// This script runs in the context of web pages
// It can interact with the web page's DOM

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageContent") {
        try {
            // Create a clone of the document
            const documentClone = document.cloneNode(true);
            
            // Create a new Readability object
            const reader = new Readability(documentClone);
            
            // Parse the content
            const article = reader.parse();
            
            if (!article) {
                sendResponse({ 
                    error: "Could not extract content from this page" 
                });
                return true;
            }

            // Combine title and content
            let extractedContent = article.title + "\n\n" + article.textContent;
            
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
        } catch (error) {
            console.error('Content extraction error:', error);
            sendResponse({ 
                error: "Failed to extract content: " + error.message 
            });
        }
    }
    return true;
}); 