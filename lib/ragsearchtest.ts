const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

async function fetchRAGSearchResults() {

const response =  await fetch(`${BASE_URL}/api/search`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        courseId: 'course123',
        prompt: 'explain relays',
        topK: 5,
        materialIds: ['material1', 'material2']
    })
})

const data =  await response.json();
console.log('Retrieved Chunks:', data.retrievedChunks); 

}

fetchRAGSearchResults().catch(console.error);