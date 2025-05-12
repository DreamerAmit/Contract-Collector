const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Function to get API key
function getApiKey() {
  // First try environment variable
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  
  // Then try to read from .env file directly
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (error) {
    console.error('Error reading .env file:', error);
  }
  
  // Hardcoded key as last resort (replace with your actual key)
  return 'sk-your-actual-api-key-here';
}

const apiKey = getApiKey();
console.log('OpenAI API Key available:', !!apiKey);

const openai = new OpenAI({
  apiKey: apiKey
});

/**
 * Analyze a contract document using OpenAI
 * 
 * @param {string} text - The extracted text from the contract document
 * @returns {Object} - Analysis results containing amount, renewalDate, and parties
 */
async function analyzeDocument(text) {
  try {
    // Prepare a prompt for contract analysis
    const prompt = `
      Please analyze this contract text and extract the following information:
      1. Contract amount or value (just the number)
      2. Renewal or expiration date (in YYYY-MM-DD format)
      3. List of parties involved in the contract (company names)
      
      You must respond ONLY with a valid JSON object containing these keys:
      {
        "amount": (number or null if not found),
        "renewalDate": (string in YYYY-MM-DD format or null if not found),
        "parties": (array of strings or empty array if not found)
      }
      
      DO NOT include any explanation, comments, or additional text outside the JSON object.
      
      Contract text:
      ${text.substring(0, 8000)}
    `;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a contract analysis assistant specializing in extracting structured data from documents. Your responses must be in valid JSON format only, with no additional text, explanations, or markdown formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0
    });

    // Since we don't enforce JSON response format, let's try to parse it safely
    let analysis;
    try {
      const responseText = response.choices[0].message.content.trim();
      // Try to extract JSON if it's wrapped in backticks or markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                       responseText.match(/\{[\s\S]*\}/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseText;
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.warn('Error parsing OpenAI response as JSON:', parseError);
      // Fallback to empty values
      analysis = { amount: null, renewalDate: null, parties: [] };
    }
    
    // Validate and format the returned data
    return {
      amount: typeof analysis.amount === 'number' ? analysis.amount : null,
      renewalDate: analysis.renewalDate && /^\d{4}-\d{2}-\d{2}$/.test(analysis.renewalDate) 
        ? analysis.renewalDate 
        : null,
      parties: Array.isArray(analysis.parties) ? analysis.parties : []
    };
  } catch (error) {
    console.error('Error analyzing document with OpenAI:', error);
    // Return default values if analysis fails
    return {
      amount: null,
      renewalDate: null,
      parties: []
    };
  }
}

/**
 * Check if the OpenAI API is properly configured
 * @returns {Promise<boolean>} - Whether the API is configured and working
 */
async function checkOpenAIConfig() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return false;
    }
    
    // Make a simple API call to test the configuration
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Hello"
        }
      ],
      max_tokens: 5
    });
    
    return response && response.choices && response.choices.length > 0;
  } catch (error) {
    console.error('OpenAI configuration check failed:', error);
    return false;
  }
}

module.exports = openai;

module.exports = {
  analyzeDocument,
  checkOpenAIConfig,
  openai
}; 