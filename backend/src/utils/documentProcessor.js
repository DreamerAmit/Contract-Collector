const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from various document types
 * @param {string} filePath - Path to the document file
 * @param {string} contentType - MIME type of the document
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromDocument(filePath, contentType) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Extract text based on content type
    if (contentType === 'application/pdf') {
      return await extractTextFromPdf(filePath);
    } else if (
      contentType === 'application/msword' || 
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return await extractTextFromDoc(filePath);
    } else if (contentType === 'text/plain') {
      // For text files, just read the content
      return fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  } catch (error) {
    console.error('Error extracting text from document:', error);
    return '';
  }
}

/**
 * Extract text from a PDF document
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPdf(filePath) {
  try {
    // Read the PDF file as a buffer
    const dataBuffer = fs.readFileSync(filePath);
    
    // Use pdf-parse to extract text
    const data = await pdf(dataBuffer);
    
    // Return extracted text
    return data.text || '';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

/**
 * Extract text from a Word document
 * @param {string} filePath - Path to the Word document
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromDoc(filePath) {
  try {
    // Read the file as a buffer
    const buffer = fs.readFileSync(filePath);
    
    // Extract text using mammoth
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from Word document:', error);
    return '';
  }
}

module.exports = {
  extractTextFromPdf,
  extractTextFromDoc,
  extractTextFromDocument
}; 