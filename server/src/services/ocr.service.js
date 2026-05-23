import cloudinary from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * OCR Service
 *
 * Flow:
 *  1. Upload document buffer → Cloudinary (raw/pdf)
 *  2. Call AI OCR engine (currently: intelligent mock with real Cloudinary URL)
 *  3. Return structured extraction + confidence + cloudinary reference
 *
 * Swap step 2 for Google Vision, AWS Textract, or Azure Form Recognizer
 * by replacing the _callOCREngine() method.
 */
class OcrService {
  /**
   * Process an uploaded document buffer and return extracted fields.
   * @param {Buffer} buffer - file buffer from multer memory storage
   * @param {string} mimeType - MIME type of the file
   * @param {string} originalName - original filename
   * @returns {Promise<OcrResult>}
   */
  async processDocument(buffer, mimeType, originalName) {
    // Step 1: Upload to Cloudinary
    const cloudResult = await this._uploadToCloudinary(buffer, mimeType, originalName);

    // Step 2: Run OCR extraction
    const extracted = await this._callOCREngine(cloudResult.secure_url, mimeType, buffer);

    return {
      cloudinaryUrl: cloudResult.secure_url,
      cloudinaryId:  cloudResult.public_id,
      sizeBytes:     buffer.length,
      mimeType,
      originalName,
      confidence:    extracted.confidence,
      rawText:       extracted.rawText,
      fields:        extracted.fields,
      processedAt:   new Date(),
    };
  }

  // ─── Private: Upload to Cloudinary ─────────────────────────────────────────
  async _uploadToCloudinary(buffer, mimeType, originalName) {
    return new Promise((resolve, reject) => {
      const isPdf = mimeType === 'application/pdf';
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder:        'finbook/sales/documents',
          resource_type: isPdf ? 'raw' : 'image',
          public_id:     `invoice_${Date.now()}`,
          use_filename:  false,
          overwrite:     true,
        },
        (error, result) => {
          if (error) reject(new ApiError(`Cloudinary upload failed: ${error.message}`, 502));
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });
  }

  // ─── Private: OCR Engine ────────────────────────────────────────────────────
  /**
   * Calls the real OCR engine. Currently returns an intelligent simulation
   * that mirrors real extracted fields. Replace with actual SDK call here.
   *
   * For Google Vision:
   *   const client = new ImageAnnotatorClient();
   *   const [result] = await client.documentTextDetection(imageBuffer);
   *   const text = result.fullTextAnnotation.text;
   *   return this._parseText(text);
   */
  async _callOCREngine(documentUrl, mimeType, buffer) {
    // ─── PADDLE OCR BRIDGE (REAL EXTRACTION) ──────────────────────────────
    console.log('--- Starting PaddleOCR Extraction ---');
    
    // 1. Create a temporary file for the buffer
    const tempDir = os.tmpdir();
    const fileName = `ocr_temp_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    const tempFilePath = path.join(tempDir, fileName);

    try {
      // Save buffer to disk for Python to read
      await fs.writeFile(tempFilePath, buffer);
      console.log(`Temp file saved at: ${tempFilePath}`);

      // 2. Spawn Python process
      const pythonScriptPath = path.join(process.cwd(), 'src', 'scripts', 'paddle_ocr_worker.py');
      
      return new Promise((resolve, reject) => {
        // Use 'python' or 'python3' based on system
        const pythonProcess = spawn('python', [pythonScriptPath, tempFilePath]);
        
        let resultData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
          resultData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString();
        });

        pythonProcess.on('close', async (code) => {
          // Cleanup: Remove temp file
          try { await fs.unlink(tempFilePath); } catch (e) { console.error('Temp file cleanup failed', e); }

          if (code !== 0) {
            console.error(`Python process failed with code ${code}: ${errorData}`);
            // Fallback if Paddle isn't set up yet, return a structured error
            return resolve({
              confidence: 0,
              rawText: 'OCR Engine Failed to start. Please check Python dependencies.',
              fields: { error: 'Python process failed' }
            });
          }

          try {
            const parsedResult = JSON.parse(resultData);
            if (!parsedResult.success) {
              return resolve({
                confidence: 0,
                rawText: parsedResult.error || 'Unknown Python Error',
                fields: {}
              });
            }

            console.log('--- OCR Extraction Complete ---');
            resolve({
              confidence: parsedResult.confidence || 95,
              rawText: parsedResult.rawText,
              fields: parsedResult.fields
            });
          } catch (e) {
            console.error('Failed to parse Python output', e, resultData);
            resolve({ confidence: 0, rawText: 'Invalid OCR Output', fields: {} });
          }
        });
      });

    } catch (error) {
      console.error('OCR Service Bridge Error:', error);
      return { confidence: 0, rawText: 'Bridge failure', fields: {} };
    }
  }

  /**
   * Basic Regex-based parser to extract fields from raw OCR text.
   * This is used when a real OCR engine (like Google Vision) returns a block of text.
   */
  _parseRawText(text) {
    const fields = {
      invoiceNumber: '',
      invoiceDate: '',
      partyGstin: '',
      grandTotal: 0,
    };

    // Very basic regex patterns (In production, use more robust patterns or LLM)
    const invMatch = text.match(/(?:Invoice|Inv|Bill)\s*(?:No|Number)?[:.#\s]*([A-Z0-9/-]+)/i);
    if (invMatch) fields.invoiceNumber = invMatch[1];

    const dateMatch = text.match(/(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(?:\d{4}[/-]\d{1,2}[/-]\d{1,2})/);
    if (dateMatch) fields.invoiceDate = dateMatch[0];

    const gstinMatch = text.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/);
    if (gstinMatch) fields.partyGstin = gstinMatch[0];

    const totalMatch = text.match(/(?:Total|Grand Total|Amount Payable)[:.\s]*[₹RS.]*\s*([\d,]+\.\d{2})/i);
    if (totalMatch) fields.grandTotal = parseFloat(totalMatch[1].replace(/,/g, ''));

    return fields;
  }

  _simulateProcessingDelay() {
    return new Promise((res) => setTimeout(res, 300)); // simulate API latency
  }

  _formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}

export default new OcrService();
