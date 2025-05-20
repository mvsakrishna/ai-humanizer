import axios from 'axios';

// API credentials
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const USER_ID = '79b84da7-bb2a-4e36-a135-e77e0f3e5144';
const API_KEY = 'dd410c04-f157-4f4c-9e41-b7d125f2b339';
// Correct API base URL for Undetectable AI
const API_BASE_URL = 'https://humanize.undetectable.ai';

// Create an axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'apikey': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 60000 // 60 second timeout
});

export type HumanizeOptions = {
  mode?: 'paraphrase' | 'rewrite';
  readability?: 'simple' | 'standard' | 'advanced';
  strength?: 'low' | 'medium' | 'high';
  conservativeness?: 'low' | 'medium' | 'high';
  tone?: 'default' | 'academic' | 'casual' | 'creative' | 'formal' | 'friendly' | 'professional';
};

// Submit document response interface
export interface SubmitDocumentResponse {
  status: string;
  id: string;
  error?: string;
}

// Document response interface
export interface DocumentResponse {
  id: string;
  output: string;
  input: string;
  readability: string;
  createdDate: string;
  purpose: string;
  error?: string;
}

/**
 * Simple text humanization that can be used as a fallback when the API is unavailable
 */
function fallbackHumanize(text: string, options: HumanizeOptions): string {
  // Split the text into sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  // Apply different transformations based on the options
  return sentences.map(sentence => {
    // Skip empty sentences
    if (!sentence.trim()) return sentence;
    
    // Apply transformations based on the selected tone
    switch(options.tone) {
      case 'academic':
        return `It has been observed that ${sentence.trim().toLowerCase()}`;
      case 'casual':
        return `So basically, ${sentence.trim().toLowerCase()}`;
      case 'creative':
        return `Imagine this: ${sentence.trim()}`;
      case 'formal':
        return `It should be noted that ${sentence.trim().toLowerCase()}`;
      case 'friendly':
        return `You know, ${sentence.trim().toLowerCase()}`;
      case 'professional':
        return `We would like to point out that ${sentence.trim().toLowerCase()}`;
      default:
        // Apply random transformations for default tone
        const rand = Math.random();
        if (rand > 0.7) {
          return `${sentence.trim()}, actually.`;
        } else if (rand > 0.4) {
          return `I believe that ${sentence.trim().toLowerCase()}`;
        } else {
          return sentence;
        }
    }
  }).join(' ');
}

/**
 * Helper function to wait for a specified time
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Humanizes text using the Undetectable AI API
 * Falls back to a simple humanization algorithm if the API is unavailable
 */
export async function humanizeText(text: string, options: HumanizeOptions = {}): Promise<string> {
  if (!text || text.trim() === '') {
    throw new Error('Text is required for humanization');
  }

  // Map our options to Undetectable AI's expected format
  const readabilityMap: Record<string, string> = {
    'simple': 'Elementary',
    'standard': 'High School',
    'advanced': 'College'
  };
  
  const strengthMap: Record<string, string> = {
    'low': 'Less Human',
    'medium': 'Balanced',
    'high': 'More Human'
  };
  
  const purposeMap: Record<string, string> = {
    'paraphrase': 'General Writing',
    'rewrite': 'Essay'
  };

  try {
    // Step 1: Submit the document for humanization
    const submitResponse = await apiClient.post<SubmitDocumentResponse>('/submit', {
      content: text,
      readability: readabilityMap[options.readability || 'standard'] || 'High School',
      purpose: purposeMap[options.mode || 'paraphrase'] || 'General Writing',
      strength: strengthMap[options.strength || 'medium'] || 'Balanced',
      model: 'v11' // Using the latest model
    });
    
    if (submitResponse.data.error) {
      throw new Error(`API submission error: ${submitResponse.data.error}`);
    }
    
    if (!submitResponse.data.id) {
      throw new Error('No document ID returned from API');
    }
    
    const documentId = submitResponse.data.id;
    
    // Step 2: Poll for the document until it's ready (max 15 attempts, 3 seconds apart)
    let documentResponse: DocumentResponse | null = null;
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const response = await apiClient.post<DocumentResponse>('/document', {
          id: documentId
        });
        
        if (response.data && response.data.output) {
          documentResponse = response.data;
          break;
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // If we get an error, the document might not be ready yet
        console.log(`Attempt ${attempts}: Document not ready yet`);
      }
      
      // Wait 3 seconds before trying again
      await sleep(3000);
    }
    
    if (documentResponse && documentResponse.output) {
      return documentResponse.output;
    } else {
      console.warn('Document processing timed out - using fallback humanization');
      // Use fallback instead of throwing an error
      return fallbackHumanize(text, {
        mode: options.mode || 'paraphrase',
        readability: options.readability || 'standard',
        strength: options.strength || 'medium',
        conservativeness: options.conservativeness || 'medium',
        tone: options.tone || 'default'
      });
    }
  } catch (error: unknown) {
    // Type guard for axios error
    const axiosError = error as {
      response?: {
        data: unknown;
        status: number;
      };
      request?: unknown;
      message?: string;
    };
    console.error('Error calling Undetectable AI:', error);
    
    // Log detailed error information for debugging
    if (axiosError.response) {
      console.error('Response data:', axiosError.response.data);
      console.error('Response status:', axiosError.response.status);
      console.error(`API error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data || {})}`);
    } else if (axiosError.request) {
      console.error('No response received from API. Please check your internet connection.');
    } else {
      console.error(`Request setup error: ${axiosError.message || 'Unknown error'}`);
    }
    
    // Instead of throwing an error, use the fallback humanization
    console.warn('Using fallback humanization due to API error');
    return fallbackHumanize(text, {
      mode: options.mode || 'paraphrase',
      readability: options.readability || 'standard',
      strength: options.strength || 'medium',
      conservativeness: options.conservativeness || 'medium',
      tone: options.tone || 'default'
    });
  }
}

export interface CreditsResponse {
  credits: number;
  status?: string;
  error?: string;
}

/**
 * Gets the remaining credits for the user from the Undetectable AI API
 * Based on the /check-user-credits endpoint from the API documentation
 */
export async function getCreditsRemaining(): Promise<number> {
  try {
    // Use the correct endpoint from the API documentation
    const response = await apiClient.get<CreditsResponse>('/check-user-credits');
    
    if (response.data && typeof response.data.credits === 'number') {
      return response.data.credits;
    } else if (response.data.error) {
      console.warn('Credits API returned error:', response.data.error);
      return 0;
    } else {
      console.warn('Credits API returned unexpected response');
      return 0;
    }
  } catch (error: unknown) {
    console.error('Error checking credits:', error);
    return 0; // Return 0 if we can't get the credits
  }
}
