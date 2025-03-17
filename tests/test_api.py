import asyncio
import httpx
import json

async def test_mcq_generation():
    """Test the MCQ generation API."""
    
    # Test content (keep it short for quicker testing)
    test_content = """
    The Python programming language is a high-level, interpreted language known for its readability and versatility.
    It was created by Guido van Rossum and first released in 1991.
    """
    
    # API endpoint
    url = "http://localhost:8000/generate-mcqs"
    
    # Request payload
    payload = {"content": test_content}
    
    try:
        # Send POST request to the API
        print("Sending request to the API...")
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=120.0)
        
        # Print response status code
        print(f"Response status code: {response.status_code}")
        
        # Process response
        if response.status_code == 200:
            # Parse JSON response
            result = response.json()
            print(f"Raw response: {json.dumps(result, indent=2)}")
        else:
            print(f"Error: {response.text}")
    
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Run the tests
    asyncio.run(test_mcq_generation())
